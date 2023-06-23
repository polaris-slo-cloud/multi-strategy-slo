import {Constructor, JsonSchema, PolarisTransformationService, ReusablePolarisTransformer} from "@polaris-sloc/core";
import {ElasticityDecisionLogic} from "@org/slos";
import {ObjectKindTransformer} from "@polaris-sloc/kubernetes";


export class ElasticityDecisionLogicTransformer implements ReusablePolarisTransformer<ElasticityDecisionLogic<any, any, any, any>> {

  private readonly objectKindTransformer = new ObjectKindTransformer();

  extractPolarisObjectInitData(polarisType: Constructor<ElasticityDecisionLogic<any, any, any, any>>, orchPlainObj: any, transformationService: PolarisTransformationService): Partial<ElasticityDecisionLogic<any, any, any, any>> {
    return this.objectKindTransformer.extractPolarisObjectInitData(polarisType, orchPlainObj, transformationService);
  }

  transformToOrchestratorPlainObject(polarisObj: ElasticityDecisionLogic<any, any, any, any>, transformationService: PolarisTransformationService): any {
    return this.objectKindTransformer.transformToOrchestratorPlainObject(polarisObj, transformationService);
  }

  transformToOrchestratorSchema(polarisSchema: JsonSchema<ElasticityDecisionLogic<any, any, any, any>>, polarisType: Constructor<ElasticityDecisionLogic<any, any, any, any>>, transformationService: PolarisTransformationService): JsonSchema {
    return this.objectKindTransformer.transformToOrchestratorSchema(polarisSchema, polarisType, transformationService) as JsonSchema;
  }

  transformToPolarisObject(polarisType: Constructor<ElasticityDecisionLogic<any, any, any, any>>, orchPlainObj: any, transformationService: PolarisTransformationService): ElasticityDecisionLogic<any, any, any, any> {
    const data = this.extractPolarisObjectInitData(polarisType, orchPlainObj, transformationService);
    const ctor = transformationService.getPolarisType(orchPlainObj);
    return new ctor(data);
  }

}
