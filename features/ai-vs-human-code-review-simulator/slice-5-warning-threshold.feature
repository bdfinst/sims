Feature: Pending Review overload warning

  @wip
  Scenario: AI queue turns red once it exceeds the default threshold
    Given I set "AI code written (LOC/hr)" to 2000
    When I press Start and 3.8 seconds pass
    Then the AI lane shows Pending Review 14 and is not in the warning state
    When 0.4 more seconds pass
    Then the AI lane shows Pending Review 16 and is in the warning state
    And the AI queue box shows a "triangle-alert" icon and a red border
    And a status message announces "AI Pending Review over threshold"
    And the Human lane is not in the warning state

  @wip
  Scenario: Displayed value at the threshold is not a warning even if the internal value is above it
    Given I set "AI code written (LOC/hr)" to 2000
    When I press Start and 3.9 seconds pass
    Then the AI lane shows Pending Review 15 and is not in the warning state
    When 0.3 more seconds pass
    Then the AI lane shows Pending Review 16 and is in the warning state

  @wip
  Scenario: A custom threshold applies to both lanes
    Given I set "Human code written (LOC/hr)" to 200, "Human PRs per day" to 4, "Reviewer speed (LOC/hr, both lanes)" to 100, and "AI code written (LOC/hr)" to 2000, and the simulation ran for 24 seconds and was paused
    And the Human lane shows Pending Review 6 and the AI lane shows Pending Review 71
    When I set "Warning threshold" to 6
    Then the Human lane is not in the warning state and the AI lane is in the warning state
    When I set "Warning threshold" to 5
    Then both lanes are in the warning state

  @wip
  Scenario: Exactly at a custom threshold is not a warning
    Given I set "Warning threshold" to 38 and "AI code written (LOC/hr)" to 2000
    When I press Start and 10 seconds pass
    Then the AI lane shows Pending Review 38 and is not in the warning state

  @wip
  Scenario: Raising the threshold while paused clears the warning
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation ran for 6 seconds and was paused
    And the AI lane shows Pending Review 23 and is in the warning state
    When I set "Warning threshold" to 25
    Then the AI lane is not in the warning state

  @wip
  Scenario: Lowering the threshold while running applies immediately
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds
    And the AI lane shows Pending Review 7 and is not in the warning state
    When I set "Warning threshold" to 5
    Then the AI lane is in the warning state

  @wip
  Scenario: Warning clears when the queue drains to the threshold
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 5 seconds
    And the AI lane shows Pending Review 19 and is in the warning state
    When I set "AI code written (LOC/hr)" to 5 and "Reviewer speed (LOC/hr, both lanes)" to 1000
    And 0.6 seconds pass
    Then the AI lane shows Pending Review 16 and is in the warning state
    When 0.1 more seconds pass
    Then the AI lane shows Pending Review 15 and is not in the warning state

  Scenario: Threshold slider default and bounds
    Given I open the simulator
    Then "Warning threshold" has value 15, min 5, max 50, and step 1

  Scenario: Reset keeps the threshold
    Given I set "Warning threshold" to 30
    When I press Reset
    Then "Warning threshold" has value 30
