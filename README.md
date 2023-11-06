# Average CPU Utilization SLO With Multiple Elasticity Strategies

A customer can specify a target CPU utilization service level objective for a target object using the [Polaris Cloud SLO Framework](https://github.com/polaris-slo-cloud/polaris).
The SLO controller measures the average CPU usage of the target deployment over a configurable duration.

The CpuUtilizationSloMapping allows you to choose a predefined decision logic or implement you own rules by implementing an instance of ElasticityDecisionLogic.
After the SLO compliance has been calculated the AverageCpuUtilization SLO controller uses the decision logic to select a suitable elasticity strategy that is applied to the workload.
It is possible to provide extra configuration for the decision logic execution by defining static configuration.
Furthermore, the decision of which elasticity strategy to use can involve any API request thereby allowing a simple and flexible way to build information rich logics.

In order to scrape metrics correctly, the target objects need to have resource limits configured, which is then automatically changed by the elasticity strategies.

### Combining Multiple Elasticity Strategies

This project aims to combine two selected elasticity strategies that are supported by the SLO mapping.
Currently, **HorizontalElasticityStrategy** and **VerticalElasticityStrategy** are the only supported strategies.

The selected elasticity strategies are applied based on a so called _ElasticityDecisionLogic_ which is responsible for encapsulating the logic for selecting a strategy that is applied to the target workload by the SLO controller.

There are several implementations of decision logic:
- **RandomDecisionLogic**: chooses an elasticity strategy randomly
- **RoundRobinDecisionLogic**: picks an elasticity strategy in a round-robin like fashion
- **BestFitDecisionLogic**: calculates the future sloCompliance as if the strategy would be applied and selects the one that is closer to 100
- **ThresholdDecisionLogic**: switches to the secondary elasticity strategy if the sloCompliance exceeds a threshold
- **PriorityDecisionLogic**: fallbacks to the secondary elasticity strategy if the primary elasticity strategy gets exhausted
- **TimeAwareDecisionLogic**: chooses a strategy based on the day of the week

In order to keep the coupling between components low, the decision logic is evaluated in the SLO controller after the compliance is calculated.
The type of the selected decision logic is injected decoratively using the SLO mapping.
