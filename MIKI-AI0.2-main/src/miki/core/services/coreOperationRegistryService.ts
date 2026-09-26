export interface CoreOperationContract<Input, Output> {
  operationId: string;
  ownerDomain: string;
  receiptRequired: boolean;
  failureState: 'FAILED';
  resumeCondition: string;
  execute(input: Input): Promise<Output>;
}

class CoreOperationRegistryService {
  private readonly operations = new Map<string, CoreOperationContract<unknown, unknown>>();

  register<Input, Output>(contract: CoreOperationContract<Input, Output>): void {
    if (this.operations.has(contract.operationId)) {
      throw new Error(`CORE_OPERATION_ALREADY_REGISTERED:${contract.operationId}`);
    }
    this.operations.set(contract.operationId, contract as CoreOperationContract<unknown, unknown>);
  }

  has(operationId: string): boolean {
    return this.operations.has(operationId);
  }

  get<Input, Output>(operationId: string): CoreOperationContract<Input, Output> {
    const contract = this.operations.get(operationId);
    if (!contract) {
      throw new Error(`CORE_OPERATION_NOT_REGISTERED:${operationId}`);
    }
    return contract as CoreOperationContract<Input, Output>;
  }

  list(): Array<CoreOperationContract<unknown, unknown>> {
    return [...this.operations.values()];
  }
}

export const coreOperationRegistryService = new CoreOperationRegistryService();
