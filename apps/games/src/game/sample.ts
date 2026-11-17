import { DEFAULT_VALUES } from "./board";
import type { BoardContent } from "./schema";

const category = (name: string, clues: ReadonlyArray<readonly [clue: string, answer: string]>) => ({
  name,
  clues: clues.map(([clue, answer]) => ({ clue, answer })),
});

/**
 * A ready-made board for trying things out: seeded in local development and offered as a
 * starting point in the admin. Placeholder trivia, not the owner's content.
 */
export const sampleBoard: BoardContent = {
  title: "Sample board",
  values: DEFAULT_VALUES,
  categories: [
    category("Brass & wind", [
      ["The lowest-pitched instrument in the brass family.", "The tuba"],
      ["This brass instrument changes pitch with a slide instead of valves.", "The trombone"],
      ["A woodwind made of brass, invented by Adolphe Sax in the 1840s.", "The saxophone"],
      [
        "The marching tuba that wraps around the player, named after an American bandleader.",
        "The sousaphone",
      ],
      ["A double horn combines two instruments: one in B-flat and one in this key.", "F"],
    ]),
    category("Around the world", [
      ["The largest country in the world by area.", "Russia"],
      ["This river flows through Vienna, Budapest and Belgrade.", "The Danube"],
      ["The capital of Australia.", "Canberra"],
      ["The smallest country in the world, entirely surrounded by Rome.", "Vatican City"],
      ["This kingdom is entirely surrounded by South Africa.", "Lesotho"],
    ]),
    category("Science lab", [
      ["It is known as the Red Planet.", "Mars"],
      ["H₂O is the chemical formula for this.", "Water"],
      ["The part of a cell known as its powerhouse.", "The mitochondrion"],
      ["The chemical element with the symbol Au.", "Gold"],
      ["The SI unit of electrical resistance.", "The ohm"],
    ]),
    category("Food & drink", [
      ["The main ingredient in guacamole.", "Avocado"],
      ["This Italian dessert's name means “pick me up”.", "Tiramisu"],
      ["The spice harvested from the stigmas of a crocus flower.", "Saffron"],
      ["Sushi rice is seasoned with this liquid.", "Rice vinegar"],
      [
        "The French term for cooking food sealed in a bag in a precisely heated water bath.",
        "Sous vide",
      ],
    ]),
    category("Numbers game", [
      ["The number of sides on a hexagon.", "Six"],
      ["The number of minutes in a full day.", "1,440"],
      ["The only even prime number.", "Two"],
      ["The number of keys on a standard piano.", "88"],
      ["In binary, the number ten is written like this.", "1010"],
    ]),
  ],
};
