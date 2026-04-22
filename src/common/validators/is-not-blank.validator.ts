import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom validator to check if a string is not blank (not empty and not only whitespace).
 * Usage: @IsNotBlank()
 */
@ValidatorConstraint({ name: 'isNotBlank', async: false })
export class IsNotBlankConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} should not be empty or contain only whitespace`;
  }
}

export function IsNotBlank(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: IsNotBlankConstraint,
    });
  };
}
