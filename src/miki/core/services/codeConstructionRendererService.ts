import type {
  CodeConstructionBinding,
  CodeConstructionGraph,
} from '../data/codeKnowledge/common';

export interface ConstructionRenderResult {
  accepted:boolean;
  source?:string;
  rootNodeId?:string;
  errors:string[];
}

class CodeConstructionRendererService {
  render(graph:CodeConstructionGraph):ConstructionRenderResult{
    if(graph.nodes.length===0){
      return {
        accepted:false,
        errors:['CONSTRUCTION_RENDER_GRAPH_EMPTY'],
      };
    }

    const rootNodeId=graph.rootNodeId||graph.nodes[0].nodeId;
    const rendered=this.renderNode(graph,rootNodeId,[]);

    if(!rendered.ok){
      return {
        accepted:false,
        rootNodeId,
        errors:rendered.errors,
      };
    }

    const source=rendered.source.trim();

    if(!source){
      return {
        accepted:false,
        rootNodeId,
        errors:['CONSTRUCTION_RENDER_EMPTY_SOURCE'],
      };
    }

    return {
      accepted:true,
      rootNodeId,
      source,
      errors:[],
    };
  }

  private renderNode(
    graph:CodeConstructionGraph,
    nodeId:string,
    stack:string[],
  ):
    | {ok:true;source:string}
    | {ok:false;errors:string[]}
  {
    if(stack.includes(nodeId)){
      return {
        ok:false,
        errors:[`CONSTRUCTION_RENDER_CYCLE:${[...stack,nodeId].join('->')}`],
      };
    }

    const node=graph.nodes.find(item=>item.nodeId===nodeId);

    if(!node){
      return {
        ok:false,
        errors:[`CONSTRUCTION_RENDER_NODE_NOT_FOUND:${nodeId}`],
      };
    }

    let template=node.profile.syntaxTemplate;
    const errors:string[]=[];
    const nextStack=[...stack,nodeId];

    for(const slot of node.profile.slots){
      const bindings=graph.bindings.filter(binding=>
        binding.targetNodeId===node.nodeId &&
        binding.slotName===slot.name
      );

      if(bindings.length===0){
        if(slot.required){
          errors.push(
            `CONSTRUCTION_RENDER_REQUIRED_SLOT_UNRESOLVED:${node.nodeId}:${slot.name}`
          );
        }else{
          template=this.removeOptionalSlot(template,slot.name);
        }
        continue;
      }

      if(slot.multiple!==true&&bindings.length>1){
        errors.push(
          `CONSTRUCTION_RENDER_MULTIPLE_BINDINGS:${node.nodeId}:${slot.name}`
        );
        continue;
      }

      const values:string[]=[];

      for(const binding of bindings){
        const value=this.renderBinding(graph,binding,nextStack);

        if(!value.ok){
          errors.push(...value.errors);
          continue;
        }

        if(value.source.trim())values.push(value.source.trim());
      }

      if(values.length===0){
        errors.push(
          `CONSTRUCTION_RENDER_EMPTY_SLOT:${node.nodeId}:${slot.name}`
        );
        continue;
      }

      template=template
        .split(`{${slot.name}}`)
        .join(slot.multiple===true?values.join('\n'):values[0]);
    }

    if(errors.length>0){
      return {ok:false,errors};
    }

    if(/\{[A-Za-z0-9_]+\}/.test(template)){
      return {
        ok:false,
        errors:[`CONSTRUCTION_RENDER_UNBOUND_TEMPLATE:${node.nodeId}`],
      };
    }

    return {ok:true,source:template};
  }

  private renderBinding(
    graph:CodeConstructionGraph,
    binding:CodeConstructionBinding,
    stack:string[],
  ):
    | {ok:true;source:string}
    | {ok:false;errors:string[]}
  {
    if(binding.sourceNodeId){
      return this.renderNode(graph,binding.sourceNodeId,stack);
    }

    if(binding.value!==undefined){
      return {
        ok:true,
        source:binding.value,
      };
    }

    return {
      ok:false,
      errors:['CONSTRUCTION_RENDER_BINDING_EMPTY'],
    };
  }

  private removeOptionalSlot(template:string,slotName:string):string{
    if(slotName==='elseBody'){
      return template.replace(
        /\s*else\s*\{\s*\{elseBody\}\s*\}/g,
        ''
      );
    }

    if(slotName==='parameters'){
      return template.replace(`{${slotName}`+'}','');
    }

    if(slotName==='result'){
      return template.replace(
        /const\s+\{result\}\s*=\s*await\s+\{operation\};/g,
        'await {operation};'
      );
    }

    return template.replace(`{${slotName}}`,'');
  }
}

export const codeConstructionRendererService =
  new CodeConstructionRendererService();
