Feature: Pending Review tiles and layout

  Background:
    Given the queue tile capacity C is read from the queue box

  @wip
  Scenario: One tile per pending PR
    Given I set "AI code written (LOC/hr)" to 2000
    When I press Start and 5.7 seconds pass
    Then the AI lane shows Pending Review 22, 22 tiles, and no overflow indicator

  Scenario: Empty queue shows no tiles
    Given I open the simulator
    Then neither Pending Review box shows any tiles

  @wip
  Scenario: Exactly at capacity has no overflow indicator
    Given I set "Human code written (LOC/hr)" to 5, "Reviewer speed (LOC/hr, both lanes)" to 100, "AI skim multiplier" to 1, and "AI code written (LOC/hr)" to 704
    When I press Start and C ticks pass
    Then the AI lane shows Pending Review C, C tiles, and no overflow indicator
    When 0.1 more seconds pass
    Then the AI lane shows Pending Review C + 1, C tiles, and the text "+1 more"

  @wip
  Scenario: Overflow beyond capacity
    Given I set "AI code written (LOC/hr)" to 2000
    When I press Start and 30 seconds pass
    Then the AI lane shows C tiles and the text "+N more", where N is 115 minus C

  @wip
  Scenario: Projector fit at 1280 × 720
    Given the viewport is 1280 × 720
    And I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 30 seconds
    Then the header, the headline ratio, and both lanes' Pending Review counts and metric grids are fully visible without scrolling

  Scenario: Metric rows line up across lanes
    Given the viewport is 1280 × 800
    Then each metric row in the Human lane has the same left edge as the matching row in the AI lane

  @wip
  Scenario: No horizontal scroll on a phone, even when overflowing
    Given the viewport is 375 × 667
    And I set "AI code written (LOC/hr)" to 2000
    When I press Start and 30 seconds pass
    Then the AI lane shows a "+N more" indicator
    And the page does not scroll horizontally
    And the two lanes are stacked one above the other
    And within each lane the inputs, the Pending Review box, and the review side appear top to bottom
    And the Start/Pause and Reset buttons are visible without scrolling

  Scenario: Wide layout reads left to right
    Given the viewport is 1280 × 800
    Then within each lane the inputs, the Pending Review box, and the review side appear left to right
    And the Start/Pause and Reset buttons sit to the right of the title

  Scenario: Dark theme
    Given I open the simulator
    Then the page background color is rgb(11, 13, 18)

  @wip
  Scenario: Every control is keyboard reachable with a visible focus ring
    Given I open the simulator
    When I Tab through the page
    Then focus visits, in order: Start, Reset, "About Warning threshold", "Warning threshold", "About Human code written (LOC/hr)", "Human code written (LOC/hr)", "About Human PRs per day", "Human PRs per day", "About Reviewer speed (LOC/hr, both lanes)", "Reviewer speed (LOC/hr, both lanes)", "About AI code written (LOC/hr)", "AI code written (LOC/hr)", "About AI skim multiplier", "AI skim multiplier", and "Research behind this simulation"
    And each has an accessible name and a non-none outline when focused
