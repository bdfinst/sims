Feature: Pending Review tiles and layout

  Background:
    Given the queue tile capacity C is read from the queue box

  Scenario: One tile per pending PR
    Given I open the simulator
    When I press Start and 1.2 seconds pass
    Then the AI lane shows Pending Review 22, 22 tiles, and no overflow indicator

  Scenario: Empty queue shows no tiles
    Given I open the simulator
    Then neither Pending Review box shows any tiles

  Scenario: Exactly at capacity has no overflow indicator
    Given I set "Human generation (PRs/hr)" to 10, "PR size (LOC, both lanes)" to 1000, and "Reviewer speed (LOC/hr, both lanes)" to 100
    When I press Start and advance one tick at a time until the Human lane shows Pending Review C
    Then the Human lane shows C tiles and no overflow indicator
    When 0.1 more seconds pass
    Then the Human lane shows C tiles and the text "+1 more"

  Scenario: Overflow beyond capacity
    Given I open the simulator
    When I press Start and 10 seconds pass
    Then the AI lane shows C tiles and the text "+N more", where N is 184 minus C

  Scenario: Projector fit at 1280 × 720
    Given the viewport is 1280 × 720 and the simulation has run for 10 seconds
    Then the header, the headline ratio, and both lanes' Pending Review counts and metric grids are fully visible without scrolling

  Scenario: Metric rows line up across lanes
    Given the viewport is 1280 × 800
    Then each metric row in the Human lane has the same left edge as the matching row in the AI lane

  Scenario: No horizontal scroll on a phone, even when overflowing
    Given the viewport is 375 × 667
    When I press Start and 10 seconds pass
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

  Scenario: Every control is keyboard reachable with a visible focus ring
    Given I open the simulator
    When I Tab through the page
    Then focus visits Start, Reset, the threshold slider, and all five model sliders
    And each has an accessible name and a non-none outline when focused
