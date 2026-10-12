Feature: Run and pause the simulation

  Scenario: Page loads paused with empty lanes
    Given I open the simulator
    Then both lanes show Pending Review 0 and Deployed 0
    And the Start/Pause button reads "Start"
    And the status reads "Paused"
    And the elapsed readout shows "0.0 work hours" with the caption "1 s = 1 work hour"

  Scenario: Header content
    Given I open the simulator
    Then the header shows the title "AI vs. Human Code Review Simulator"
    And the header shows "Watch AI-speed code generation swamp human reviewers and push more defects into production."
    And the Start/Pause and Reset buttons follow the title in reading order

  Scenario: Lane identity
    Given I open the simulator
    Then the Human lane has a "user" icon at generation, an "eye" icon at review, and a blue accent
    And the AI lane has a "bot" icon at generation, an "eye" icon at review, and a purple accent

  Scenario: Nothing moves while paused
    Given I open the simulator
    When 5 seconds pass without pressing Start
    Then both lanes still show Pending Review 0 and Deployed 0
    And the elapsed readout shows "0.0 work hours"

  Scenario: Start switches the button to Pause
    Given I open the simulator
    When I press Start
    Then the Start/Pause button reads "Pause" and the status reads "Running"

  @wip
  Scenario: Default flow after 10 seconds
    Given I open the simulator
    When I press Start and 10 seconds pass
    Then the Human lane shows Pending Review 0 and Deployed 1
    And the AI lane shows Pending Review 0 and Deployed 1
    And the elapsed readout shows "10.0 work hours"

  @wip
  Scenario: A PR is not shown as deployed until it is fully reviewed
    Given I open the simulator
    When I press Start and 7.9 seconds pass
    Then the Human lane shows Deployed 0
    When 0.1 more seconds pass
    Then the Human lane shows Deployed 1

  @wip
  Scenario: Pause freezes the counts
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 3 seconds
    When I press Pause and 5 more seconds pass
    Then the AI lane shows Pending Review 11 and Deployed 4
    And the elapsed readout shows "3.0 work hours"
    And the Start/Pause button reads "Start"

  @wip
  Scenario: Resume continues from the frozen counts
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation was paused after 3 seconds
    When I press Start and 1 second passes
    Then the AI lane shows Pending Review 15 and Deployed 6

  @wip
  Scenario: Deployed never decreases while running
    Given I set "AI code written (LOC/hr)" to 2000 and press Start
    Then each lane's Deployed count, sampled every tick for 10 seconds, never decreases

  @wip
  Scenario: Hiding the tab auto-pauses
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 1 second
    When the page becomes hidden
    And 3 seconds pass
    Then the status reads "Paused" and the AI lane still shows Pending Review 3

  @wip
  Scenario: Showing the tab again stays paused
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation auto-paused when the page became hidden after 1 second
    When the page becomes visible again
    And 2 seconds pass
    Then the status reads "Paused" and the AI lane still shows Pending Review 3

  Scenario: Hiding the tab while paused changes nothing
    Given I open the simulator
    When the page becomes hidden
    Then the status reads "Paused" and all counts show 0

  Scenario: The build is one self-contained file
    Given the project is built
    Then dist/index.html exists
    And it has no script element with a src attribute, no stylesheet link, no modulepreload link, and no icon link to a file
    And dist contains no other JS or CSS files

  @wip
  Scenario: The built file runs from disk with no other requests
    Given the project is built
    When I open dist/index.html from the file system
    Then the header title is visible
    When I set "AI code written (LOC/hr)" to 2000, press Start, and 1 second passes
    Then the AI lane shows Pending Review 3
    And the only request made was for the document itself
