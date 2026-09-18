import { describe, expect, it } from "vitest";
import { round2 } from "./round";

describe("round2 — matches Python round(x, 2) (ties to even on exact binary value)", () => {
  const cases: Array<[number, number]> = [
    [69.685, 69.69], // 69.685 is really 69.685000…0227 → up
    [2.675, 2.67], // 2.675 is really 2.67499…98 → down
    [356.115, 356.12],
    [0.125, 0.12], // exact half → even cent (2)
    [0.135, 0.14], // 0.135 is really 0.13500…02 → up
    [0.5, 0.5],
    [115.8, 115.8],
    [-37.26, -37.26],
    [251.625, 251.62], // exact half → even
    [-90.125, -90.12], // exact half, negative → even
    [0, 0],
    [1000000.005, 1000000.01],
  ];
  it.each(cases)("round2(%f) === %f", (input, expected) => {
    expect(round2(input)).toBe(expected);
  });
});
