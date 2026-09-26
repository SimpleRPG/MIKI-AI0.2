import ts from 'typescript';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

export type AstCandidateOperation =
  | { kind:'ADD_IMPORT'; moduleSpecifier:string; namedImports:string[] }
  | { kind:'ADD_INTERFACE_FIELD'; interfaceName:string; fieldName:string; fieldType:string; optional?:boolean }
  | { kind:'ADD_PARAMETER'; functionName:string; parameterName:string; parameterType:string; optional?:boolean }
  | { kind:'ADD_OBJECT_PROPERTY'; variableName:string; propertyName:string; expression:string }
  | { kind:'ADD_VALIDATION_GUARD'; functionName:string; condition:string; failureStatement:string }
  | { kind:'ADD_CALL_ARGUMENT'; calleeName:string; argumentExpression:string };

export interface AstCandidateTransformationRequest {
  path:string;
  baselineContent:string;
  expectedBaselineSha256:string;
  operations:AstCandidateOperation[];
}

export interface AstCandidateTransformationResult {
  accepted:boolean;
  path:string;
  candidateContent?:string;
  baselineSha256:string;
  candidateSha256?:string;
  appliedOperations:string[];
  reasons:string[];
}

class AstCandidateTransformationService {
  public transform(request:AstCandidateTransformationRequest):AstCandidateTransformationResult {
    const baselineSha256=canonicalSha256(request.baselineContent);
    if(baselineSha256!==request.expectedBaselineSha256){
      return {accepted:false,path:request.path,baselineSha256,appliedOperations:[],reasons:['BASELINE_SHA256_MISMATCH']};
    }
    if(request.operations.length===0){
      return {accepted:false,path:request.path,baselineSha256,appliedOperations:[],reasons:['AST_OPERATIONS_REQUIRED']};
    }
    const source=ts.createSourceFile(request.path,request.baselineContent,ts.ScriptTarget.ES2022,true,this.scriptKind(request.path));
    const diagnostics=(source as ts.SourceFile&{parseDiagnostics?:readonly ts.Diagnostic[]}).parseDiagnostics||[];
    if(diagnostics.length>0){
      return {accepted:false,path:request.path,baselineSha256,appliedOperations:[],reasons:diagnostics.map(item=>`BASELINE_PARSE_DIAGNOSTIC:${ts.flattenDiagnosticMessageText(item.messageText,' ')}`)};
    }
    let statements=[...source.statements];
    const applied:string[]=[];
    const reasons:string[]=[];
    for(const operation of request.operations){
      const outcome=this.applyOperation(source,statements,operation);
      statements=outcome.statements;
      if(outcome.applied)applied.push(this.operationIdentity(operation));
      else reasons.push(outcome.reason);
    }
    if(reasons.length>0){
      return {accepted:false,path:request.path,baselineSha256,appliedOperations:applied,reasons};
    }
    const updated=ts.factory.updateSourceFile(source,statements);
    const candidateContent=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(updated);
    const candidate=ts.createSourceFile(request.path,candidateContent,ts.ScriptTarget.ES2022,true,this.scriptKind(request.path));
    const candidateDiagnostics=(candidate as ts.SourceFile&{parseDiagnostics?:readonly ts.Diagnostic[]}).parseDiagnostics||[];
    if(candidateDiagnostics.length>0){
      return {accepted:false,path:request.path,baselineSha256,appliedOperations:applied,reasons:candidateDiagnostics.map(item=>`CANDIDATE_PARSE_DIAGNOSTIC:${ts.flattenDiagnosticMessageText(item.messageText,' ')}`)};
    }
    const candidateSha256=canonicalSha256(candidateContent);
    if(candidateSha256===baselineSha256){
      return {accepted:false,path:request.path,baselineSha256,candidateSha256,appliedOperations:applied,reasons:['AST_TRANSFORMATION_NO_CHANGE']};
    }
    return {accepted:true,path:request.path,baselineSha256,candidateSha256,candidateContent,appliedOperations:applied,reasons:[]};
  }

  private applyOperation(source:ts.SourceFile,statements:ts.Statement[],operation:AstCandidateOperation):{statements:ts.Statement[];applied:boolean;reason:string}{
    if(operation.kind==='ADD_IMPORT')return this.addImport(statements,operation);
    if(operation.kind==='ADD_INTERFACE_FIELD')return this.addInterfaceField(source,statements,operation);
    if(operation.kind==='ADD_PARAMETER')return this.addParameter(source,statements,operation);
    if(operation.kind==='ADD_OBJECT_PROPERTY')return this.addObjectProperty(source,statements,operation);
    if(operation.kind==='ADD_VALIDATION_GUARD')return this.addValidationGuard(source,statements,operation);
    return this.addCallArgument(source,statements,operation);
  }

  private addImport(statements:ts.Statement[],operation:Extract<AstCandidateOperation,{kind:'ADD_IMPORT'}>):{statements:ts.Statement[];applied:boolean;reason:string}{
    const names=[...new Set(operation.namedImports.map(value=>value.trim()).filter(Boolean))].sort();
    if(!operation.moduleSpecifier.trim()||names.length===0)return {statements,applied:false,reason:'ADD_IMPORT_INVALID'};
    const existingIndex=statements.findIndex(statement=>ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier)&&statement.moduleSpecifier.text===operation.moduleSpecifier);
    if(existingIndex>=0){
      const existing=statements[existingIndex] as ts.ImportDeclaration;
      const current=existing.importClause?.namedBindings&&ts.isNamedImports(existing.importClause.namedBindings)?existing.importClause.namedBindings.elements.map(element=>element.name.text):[];
      const merged=[...new Set([...current,...names])].sort();
      if(merged.length===current.length)return {statements,applied:false,reason:`IMPORT_ALREADY_PRESENT:${operation.moduleSpecifier}`};
      const updated=ts.factory.updateImportDeclaration(existing,existing.modifiers,ts.factory.updateImportClause(existing.importClause!,existing.importClause!.isTypeOnly,existing.importClause!.name,ts.factory.createNamedImports(merged.map(name=>ts.factory.createImportSpecifier(false,undefined,ts.factory.createIdentifier(name))))),existing.moduleSpecifier,existing.attributes);
      const next=[...statements];next[existingIndex]=updated;return {statements:next,applied:true,reason:''};
    }
    const created=ts.factory.createImportDeclaration(undefined,ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports(names.map(name=>ts.factory.createImportSpecifier(false,undefined,ts.factory.createIdentifier(name))))),ts.factory.createStringLiteral(operation.moduleSpecifier),undefined);
    const lastImport=statements.reduce((index,statement,current)=>ts.isImportDeclaration(statement)?current:index,-1);
    const next=[...statements];next.splice(lastImport+1,0,created);return {statements:next,applied:true,reason:''};
  }

  private addInterfaceField(source:ts.SourceFile,statements:ts.Statement[],operation:Extract<AstCandidateOperation,{kind:'ADD_INTERFACE_FIELD'}>):{statements:ts.Statement[];applied:boolean;reason:string}{
    let found=false;let applied=false;
    const next=statements.map(statement=>{
      if(!ts.isInterfaceDeclaration(statement)||statement.name.text!==operation.interfaceName)return statement;
      found=true;if(statement.members.some(member=>member.name?.getText(source)===operation.fieldName))return statement;
      applied=true;const type=this.parseType(operation.fieldType);
      return ts.factory.updateInterfaceDeclaration(statement,statement.modifiers,statement.name,statement.typeParameters,statement.heritageClauses,[...statement.members,ts.factory.createPropertySignature(undefined,operation.fieldName,operation.optional?ts.factory.createToken(ts.SyntaxKind.QuestionToken):undefined,type)]);
    });
    return {statements:next,applied,reason:applied?'':found?`INTERFACE_FIELD_ALREADY_PRESENT:${operation.interfaceName}.${operation.fieldName}`:`INTERFACE_NOT_FOUND:${operation.interfaceName}`};
  }

  private addParameter(source:ts.SourceFile,statements:ts.Statement[],operation:Extract<AstCandidateOperation,{kind:'ADD_PARAMETER'}>):{statements:ts.Statement[];applied:boolean;reason:string}{
    let found=false;let applied=false;
    const transformed=ts.transform(statements,[context=>{
      const visitor=(node:ts.Node):ts.VisitResult<ts.Node>=>{
        if((ts.isFunctionDeclaration(node)&&node.name?.text===operation.functionName)||(ts.isMethodDeclaration(node)&&node.name.getText(source)===operation.functionName)){
          found=true;if(node.parameters.some(item=>item.name.getText(source)===operation.parameterName))return node;applied=true;
          const parameter=ts.factory.createParameterDeclaration(undefined,undefined,operation.parameterName,operation.optional?ts.factory.createToken(ts.SyntaxKind.QuestionToken):undefined,this.parseType(operation.parameterType),undefined);
          if(ts.isFunctionDeclaration(node))return ts.factory.updateFunctionDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.typeParameters,[...node.parameters,parameter],node.type,node.body);
          return ts.factory.updateMethodDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.questionToken,node.typeParameters,[...node.parameters,parameter],node.type,node.body);
        }
        return ts.visitEachChild(node,visitor,context);
      };
      return node=>ts.visitNode(node,visitor) as ts.Statement;
    }]);
    const next=[...transformed.transformed] as ts.Statement[];transformed.dispose();
    return {statements:next,applied,reason:applied?'':found?`PARAMETER_ALREADY_PRESENT:${operation.functionName}.${operation.parameterName}`:`FUNCTION_NOT_FOUND:${operation.functionName}`};
  }

  private addObjectProperty(source:ts.SourceFile,statements:ts.Statement[],operation:Extract<AstCandidateOperation,{kind:'ADD_OBJECT_PROPERTY'}>):{statements:ts.Statement[];applied:boolean;reason:string}{
    let found=false;let applied=false;const expression=this.parseExpression(operation.expression);
    const transformed=ts.transform(statements,[context=>{
      const visitor=(node:ts.Node):ts.VisitResult<ts.Node>=>{
        if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text===operation.variableName&&node.initializer&&ts.isObjectLiteralExpression(node.initializer)){
          found=true;if(node.initializer.properties.some(property=>property.name?.getText(source)===operation.propertyName))return node;applied=true;
          return ts.factory.updateVariableDeclaration(node,node.name,node.exclamationToken,node.type,ts.factory.updateObjectLiteralExpression(node.initializer,[...node.initializer.properties,ts.factory.createPropertyAssignment(operation.propertyName,expression)]));
        }
        return ts.visitEachChild(node,visitor,context);
      };
      return node=>ts.visitNode(node,visitor) as ts.Statement;
    }]);
    const next=[...transformed.transformed] as ts.Statement[];transformed.dispose();
    return {statements:next,applied,reason:applied?'':found?`OBJECT_PROPERTY_ALREADY_PRESENT:${operation.variableName}.${operation.propertyName}`:`OBJECT_VARIABLE_NOT_FOUND:${operation.variableName}`};
  }

  private addValidationGuard(source:ts.SourceFile,statements:ts.Statement[],operation:Extract<AstCandidateOperation,{kind:'ADD_VALIDATION_GUARD'}>):{statements:ts.Statement[];applied:boolean;reason:string}{
    let found=false;let applied=false;
    const condition=this.createGuardExpression(operation.condition);
    const failure=this.createFailureStatement(operation.failureStatement);
    const transformed=ts.transform(statements,[context=>{
      const visitor=(node:ts.Node):ts.VisitResult<ts.Node>=>{
        if(((ts.isFunctionDeclaration(node)&&node.name?.text===operation.functionName)||(ts.isMethodDeclaration(node)&&node.name.getText(source)===operation.functionName))&&node.body){
          found=true;
          const identity=operation.condition.replace(/\s+/g,'');
          if(node.body.statements.some(statement=>statement.getText(source).replace(/\s+/g,'').includes(identity)))return node;
          applied=true;
          const guard=ts.factory.createIfStatement(ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,ts.factory.createParenthesizedExpression(condition)),ts.factory.createBlock([failure],true));
          const body=ts.factory.updateBlock(node.body,[guard,...node.body.statements]);
          if(ts.isFunctionDeclaration(node))return ts.factory.updateFunctionDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,body);
          return ts.factory.updateMethodDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.questionToken,node.typeParameters,node.parameters,node.type,body);
        }
        return ts.visitEachChild(node,visitor,context);
      };
      return node=>ts.visitNode(node,visitor) as ts.Statement;
    }]);
    const next=[...transformed.transformed] as ts.Statement[];transformed.dispose();
    return {statements:next,applied,reason:applied?'':found?`VALIDATION_GUARD_ALREADY_PRESENT:${operation.functionName}`:`VALIDATION_FUNCTION_NOT_FOUND:${operation.functionName}`};
  }

  private parseType(text:string):ts.TypeNode {
    const source=ts.createSourceFile('type.ts',`type T=${text};`,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
    const declaration=source.statements.find(ts.isTypeAliasDeclaration);
    return declaration?.type||ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  private parseExpression(text:string):ts.Expression {
    const source=ts.createSourceFile('expression.ts',`const value=${text};`,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
    const statement=source.statements.find(ts.isVariableStatement);
    return statement?.declarationList.declarations[0]?.initializer||ts.factory.createIdentifier('undefined');
  }

  private addCallArgument(source:ts.SourceFile,statements:ts.Statement[],operation:Extract<AstCandidateOperation,{kind:'ADD_CALL_ARGUMENT'}>):{statements:ts.Statement[];applied:boolean;reason:string}{
    let found=false;let applied=false;const argument=this.createAtomicExpression(operation.argumentExpression.trim());
    const transformed=ts.transform(statements,[context=>{
      const visitor=(node:ts.Node):ts.VisitResult<ts.Node>=>{
        if(ts.isCallExpression(node)){
          const name=ts.isIdentifier(node.expression)?node.expression.text:ts.isPropertyAccessExpression(node.expression)?node.expression.name.text:'';
          if(name===operation.calleeName){
            found=true;
            if(node.arguments.some(item=>item.getText(source).replace(/\s+/g,'')===operation.argumentExpression.replace(/\s+/g,'')))return node;
            applied=true;return ts.factory.updateCallExpression(node,node.expression,node.typeArguments,[...node.arguments,argument]);
          }
        }
        return ts.visitEachChild(node,visitor,context);
      };
      return node=>ts.visitNode(node,visitor) as ts.Statement;
    }]);
    const next=[...transformed.transformed] as ts.Statement[];transformed.dispose();
    return {statements:next,applied,reason:applied?'':found?`CALL_ARGUMENT_ALREADY_PRESENT:${operation.calleeName}`:`CALL_SITE_NOT_FOUND:${operation.calleeName}`};
  }

  private createGuardExpression(text:string):ts.Expression {
    const value=text.trim();
    const binary=value.match(/^([A-Za-z_$][\w$.]*)\s*(===|!==|>=|<=|>|<)\s*([A-Za-z_$][\w$.]*|-?\d+(?:\.\d+)?|true|false)$/);
    if(binary){
      const operators:Record<string,ts.BinaryOperator>={'===':ts.SyntaxKind.EqualsEqualsEqualsToken,'!==':ts.SyntaxKind.ExclamationEqualsEqualsToken,'>=':ts.SyntaxKind.GreaterThanEqualsToken,'<=':ts.SyntaxKind.LessThanEqualsToken,'>':ts.SyntaxKind.GreaterThanToken,'<':ts.SyntaxKind.LessThanToken};
      return ts.factory.createBinaryExpression(this.createAtomicExpression(binary[1]),operators[binary[2]],this.createAtomicExpression(binary[3]));
    }
    return this.createAtomicExpression(value);
  }

  private createAtomicExpression(text:string):ts.Expression {
    if(/^[-]?\d+(?:\.\d+)?$/.test(text))return ts.factory.createNumericLiteral(text);
    if(text==='true'||text==='false')return text==='true'?ts.factory.createTrue():ts.factory.createFalse();
    const parts=text.split('.').filter(Boolean);let expression:ts.Expression=ts.factory.createIdentifier(parts.shift()||'undefined');
    for(const part of parts)expression=ts.factory.createPropertyAccessExpression(expression,part);
    return expression;
  }

  private createFailureStatement(text:string):ts.Statement {
    const message=text.match(/Error\s*\(\s*['"]([^'"]+)['"]\s*\)/)?.[1]||'VALIDATION_FAILED';
    return ts.factory.createThrowStatement(ts.factory.createNewExpression(ts.factory.createIdentifier('Error'),undefined,[ts.factory.createStringLiteral(message)]));
  }

  private operationIdentity(operation:AstCandidateOperation):string{return canonicalSha256(operation).slice(0,20);}
  private scriptKind(path:string):ts.ScriptKind{return path.endsWith('.tsx')?ts.ScriptKind.TSX:path.endsWith('.jsx')?ts.ScriptKind.JSX:path.endsWith('.js')?ts.ScriptKind.JS:ts.ScriptKind.TS;}

}

export const astCandidateTransformationService=new AstCandidateTransformationService();
