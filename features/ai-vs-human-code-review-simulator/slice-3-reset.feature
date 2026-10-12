Feature: Reset the simulation

  @wip
  Scenario: Reset while running clears lanes and elapsed time, pauses, and keeps settings
    Given I set "AI code written (LOC/hr)" to 400 and "Human PRs per day" to 2
    And the simulation is running and has run for 3 seconds
    When I press Reset
    Then both lanes show Pending Review 0 and Deployed 0
    And the elapsed readout shows "0.0 work hours"
    And the Start/Pause button reads "Start"
    And "AI code written (LOC/hr)" has value 400 and "Human PRs per day" has value 2

  @wip
  Scenario: Reset while paused with non-zero counts clears them
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation ran for 3 seconds and was paused
    And the AI lane shows Pending Review 11 and Deployed 4
    When I press Reset
    Then both lanes show Pending Review 0 and Deployed 0

  Scenario: Counts stay at zero after Reset
    Given I pressed Reset while running
    When 5 seconds pass
    Then both lanes still show Pending Review 0 and Deployed 0

  Scenario: Reset on a fresh page changes nothing
    Given I open the simulator
    When I press Reset
    Then both lanes show Pending Review 0 and Deployed 0 and the Start/Pause button reads "Start"

  @wip
  Scenario: Start after Reset runs from zero with the kept settings
    Given I set "AI code written (LOC/hr)" to 2000 and pressed Reset
    When I press Start and 1 second passes
    Then the AI lane shows Pending Review 3 and Deployed 1

  @wip
  Scenario: Reset is keyboard operable
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 1 second
    When I Tab to "Reset" and press Enter
    Then both lanes show Pending Review 0 and Deployed 0
