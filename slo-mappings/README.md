# SLO Mappings

This folder contains instances of SLO mappings.
To apply an SLO mapping to a workload, you need to create a .ts file to instantiate and configure the respective class.
This folder collects all these .ts files.

To serialize an SLO mapping, use the following command:

```sh
polaris-cli serialize <slo-mapping-path-within-folder>
```

For example:

```sh
# Serializes the SLO mapping contained in 'slo-mappings/examples/my-test-slo.ts'
polaris-cli serialize examples/my-test-slo
```
