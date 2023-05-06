import {Constructor, JsonSchema, PolarisTransformationService, ReusablePolarisTransformer} from "@polaris-sloc/core";
import {ElasticityDecisionLogic} from "@org/slos";


export class ElasticityDecisionLogicTransformer implements ReusablePolarisTransformer<ElasticityDecisionLogic<any, any, any, any>> {
  extractPolarisObjectInitData(polarisType: Constructor<ElasticityDecisionLogic<any, any, any, any>>, orchPlainObj: any, transformationService: PolarisTransformationService): Partial<ElasticityDecisionLogic<any, any, any, any>> {
    return { ...orchPlainObj };
  }

  transformToOrchestratorPlainObject(polarisObj: ElasticityDecisionLogic<any, any, any, any>, transformationService: PolarisTransformationService): any {
    return { ...polarisObj };
  }

  //We do not use custom resource definitions for elasticity decision logics
  transformToOrchestratorSchema(polarisSchema: JsonSchema<ElasticityDecisionLogic<any, any, any, any>>, polarisType: Constructor<ElasticityDecisionLogic<any, any, any, any>>, transformationService: PolarisTransformationService): JsonSchema {
    return undefined;
  }

  transformToPolarisObject(polarisType: Constructor<ElasticityDecisionLogic<any, any, any, any>>, orchPlainObj: any, transformationService: PolarisTransformationService): ElasticityDecisionLogic<any, any, any, any> {
    const data = this.extractPolarisObjectInitData(polarisType, orchPlainObj, transformationService);
    return new polarisType(data);
  }

}
