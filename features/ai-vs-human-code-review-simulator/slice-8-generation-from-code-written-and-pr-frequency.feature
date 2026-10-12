Feature: Generate code and derive PR size

  Scenario: AI PR size follows the human PR size
    Given I open the simulator
    When I set "Human PRs per day" to 0.5
    Then the Human lane shows "PR size 480 LOC (derived)"
    And the AI lane shows "PR size 725 LOC (1.51× human)" and "0.58 PRs/day (derived)"

  Scenario: AI code written changes only the AI PR frequency
    Given I open the simulator
    When I set "AI code written (LOC/hr)" to 2000
    Then the AI lane shows "PR size 362 LOC (1.51× human)" and "44.15 PRs/day (derived)"
    And the Human lane still shows "PR size 240 LOC (derived)"

  Scenario: Raising AI code written past review capacity grows the AI queue
    Given I set "AI code written (LOC/hr)" to 1000
    When I press Start and 15 seconds pass
    Then the AI lane shows Pending Review 16 and is in the warning state
    And the AI Pending LOC, sampled every tick, strictly increased

  Scenario: AI code written at review capacity keeps the queue empty
    Given I set "AI code written (LOC/hr)" to 600
    When I press Start and 10 seconds pass
    Then the AI lane shows Pending Review 0 and Deployed 16
