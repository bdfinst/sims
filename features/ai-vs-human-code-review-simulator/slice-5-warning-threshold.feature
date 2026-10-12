Feature: Pending Review overload warning

  Scenario: AI queue turns red once it exceeds the default threshold
    Given I open the simulator
    When I press Start and 0.8 seconds pass
    Then the AI lane shows Pending Review 14 and is not in the warning state
    When 0.1 more seconds pass
    Then the AI lane shows Pending Review 16 and is in the warning state
    And the AI queue box shows a "triangle-alert" icon and a red border
    And a status message announces "AI Pending Review over threshold"
    And the Human lane is not in the warning state

  Scenario: Displayed value at the threshold is not a warning even if the internal value is above it
    Given I set "Human generation (PRs/hr)" to 10
    When I press Start and 1.8 seconds pass
    Then the Human lane shows Pending Review 15 and is not in the warning state
    When 0.1 more seconds pass
    Then the Human lane shows Pending Review 16 and is in the warning state

  Scenario: A custom threshold applies to both lanes
    Given I set "Human generation (PRs/hr)" to 10 and the simulation ran for 2 seconds and was paused
    And the Human lane shows Pending Review 17 and the AI lane shows Pending Review 36
    When I set "Warning threshold" to 17
    Then the Human lane is not in the warning state and the AI lane is in the warning state
    When I set "Warning threshold" to 16
    Then both lanes are in the warning state

  Scenario: Exactly at a custom threshold is not a warning
    Given I set "Warning threshold" to 18
    When I press Start and 1 second passes
    Then the AI lane shows Pending Review 18 and is not in the warning state

  Scenario: Raising the threshold while paused clears the warning
    Given the simulation ran for 1.2 seconds and was paused
    And the AI lane shows Pending Review 22 and is in the warning state
    When I set "Warning threshold" to 25
    Then the AI lane is not in the warning state

  Scenario: Lowering the threshold while running applies immediately
    Given the simulation has run for 0.5 seconds
    And the AI lane shows Pending Review 9 and is not in the warning state
    When I set "Warning threshold" to 5
    Then the AI lane is in the warning state

  Scenario: Warning clears when the queue drains to the threshold
    Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds
    And the Human lane shows Pending Review 17 and is in the warning state
    When I set "Human generation (PRs/hr)" to 1 and "Reviewer speed (LOC/hr, both lanes)" to 1000
    And 0.5 seconds pass
    Then the Human lane shows Pending Review 16 and is in the warning state
    When 0.1 more seconds pass
    Then the Human lane shows Pending Review 15 and is not in the warning state

  Scenario: Threshold slider default and bounds
    Given I open the simulator
    Then "Warning threshold" has value 15, min 5, max 50, and step 1

  Scenario: Reset keeps the threshold
    Given I set "Warning threshold" to 30
    When I press Reset
    Then "Warning threshold" has value 30
