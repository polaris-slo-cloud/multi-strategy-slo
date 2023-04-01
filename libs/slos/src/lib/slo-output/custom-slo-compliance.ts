import {SloCompliance} from '@polaris-sloc/core';

export class CustomSloCompliance extends SloCompliance {

  maxAllocatableCpuMillis: number;

  constructor(initData?: Partial<CustomSloCompliance>) {
    super();
    Object.assign(this, initData);
  }
}
