declare module 'mongoose-unique-validator' {
  import type { Schema } from 'mongoose';

  interface UniqueValidatorOptions {
    message?: string;
    type?: string;
  }

  function mongooseUniqueValidator(
    schema: Schema,
    options?: UniqueValidatorOptions,
  ): void;

  export = mongooseUniqueValidator;
}
