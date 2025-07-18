import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

type DeepTrim<T> = T extends string
  ? string
  : T extends Array<infer U>
    ? Array<DeepTrim<U>>
    : T extends object
      ? { [K in keyof T]: DeepTrim<T[K]> }
      : T;

@Injectable()
export class TrimPipe implements PipeTransform {
  transform<T>(value: T, metadata: ArgumentMetadata): DeepTrim<T> {
    // Only process request data
    if (!['body', 'query', 'param', 'custom'].includes(metadata.type)) {
      return value as DeepTrim<T>;
    }

    return this.deepTrim(value);
  }

  private deepTrim<T>(value: T): DeepTrim<T> {
    if (value === null || value === undefined) {
      return value as DeepTrim<T>;
    }

    if (typeof value === 'string') {
      return value.trim() as DeepTrim<T>;
    }

    if (Array.isArray(value)) {
      return (value as unknown[]).map((item) =>
        this.deepTrim(item),
      ) as DeepTrim<T>;
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      value.constructor === Object
    ) {
      const result = {} as DeepTrim<T>;
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          (result as Record<string, unknown>)[key] = this.deepTrim(
            (value as Record<string, unknown>)[key],
          );
        }
      }
      return result;
    }

    return value as DeepTrim<T>;
  }
}
