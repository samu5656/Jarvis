import { WorkflowCondition } from './types';

export class ConditionEvaluator {
  static evaluateConditions(conditions: WorkflowCondition[] | undefined, context: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every((cond) => this.evaluateSingleCondition(cond, context));
  }

  private static evaluateSingleCondition(cond: WorkflowCondition, context: Record<string, any>): boolean {
    const actualValue = this.extractFieldValue(cond.field, context);

    switch (cond.operator) {
      case 'equals':
        return actualValue === cond.value;

      case 'not_equals':
        return actualValue !== cond.value;

      case 'contains':
        if (typeof actualValue === 'string') {
          return actualValue.includes(String(cond.value));
        }
        if (Array.isArray(actualValue)) {
          return actualValue.includes(cond.value);
        }
        return false;

      case 'greater_than':
        return Number(actualValue) > Number(cond.value);

      case 'less_than':
        return Number(actualValue) < Number(cond.value);

      case 'exists':
        return actualValue !== undefined && actualValue !== null;

      default:
        return false;
    }
  }

  private static extractFieldValue(path: string, obj: Record<string, any>): any {
    const parts = path.split('.');
    let curr: any = obj;
    for (const part of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[part];
    }
    return curr;
  }
}
