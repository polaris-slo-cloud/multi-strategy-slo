# Random Decision Logic

## Introduction

The Round Robing Decision Logic supports multiple elasticity strategies. Strategies are placed in a circular queue and executed one by another.
The selection of elasticity strategy does not have an effect on the type of scaling action meaning that the scaling direction only depends on SloCompliance.


## Motivation

Round Robin Logic acts as a baseline for testing and comparing elasticity strategies and used only for research purposes.
Multiple elasticity strategies can be easily combined thanks to its simplicity.


## Test Case

| Workload      | Min | Max |
|---------------|-----|-----|
| Pod CPU mi    | 50  | 200 |
| Pod Memory Mi | 50  | 100 |
| Scale         | 1   | 10  |


![plot](round_r_horizontal.png)
