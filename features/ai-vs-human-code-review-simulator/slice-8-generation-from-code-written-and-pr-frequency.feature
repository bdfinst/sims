Feature: Generate code and derive PR size

  @wip
  Scenario: AI PR size follows the human PR size
    Given I open the simulator
    When I set "Human PRs per day" to 0.5
    Then the Human lane shows "PR size 480 LOC (derived)"
    And the AI lane shows "PR size 725 LOC (1.51× human)" and "0.58 PRs/day (derived)"

  @wip
  Scenario: AI code written changes only the AI PR frequency
    Given I open the simulator
    When I set "AI code written (LOC/hr)" to 2000
    Then the AI lane shows "PR size 362 LOC (1.51× human)" and "44.15 PRs/day (derived)"
    And the Human lane still shows "PR size 240 LOC (derived)"

  @wip
  Scenario: A human PR can span several days
    Given I set "Human PRs per day" to 0.25
    Then the Human lane shows "PR size 960 LOC (derived)" and Defects caught 4%
    And the AI lane shows "PR size 1,450 LOC (1.51× human)" and "0.29 PRs/day (derived)"

  @wip
  Scenario: Derived values round to whole LOC and two decimals
    Given I set "Human code written (LOC/hr)" to 35 and "Human PRs per day" to 0.75
    Then the Human lane shows "PR size 373 LOC (derived)"
    And the AI lane shows "PR size 564 LOC (1.51× human)" and "0.75 PRs/day (derived)"

  @wip
  Scenario: Raising AI code written past review capacity grows the AI queue
    Given I set "AI code written (LOC/hr)" to 1000
    When I press Start and 15 seconds pass
    Then the AI lane shows Pending Review 16 and is in the warning state
    And the AI Pending LOC, sampled every tick, strictly increased

  @wip
  Scenario: AI code written at review capacity keeps the queue empty
    Given I set "AI code written (LOC/hr)" to 600
    When I press Start and 10 seconds pass
    Then the AI lane shows Pending Review 0 and Deployed 16
