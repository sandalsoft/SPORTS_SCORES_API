import { TestTable } from "../types";
import { rundownRepo } from "./rundown-repo";
// If the input is too big to include as a var here, slurp it in from a file.
// import jetpack from "fs-jetpack";
// const testData =
//   jetpack.read(`./test/test-data-file`, `json`) || `{this is bad json}}}}`;


// <<<<<<<<<    Enable mocking by uncommenting me   >>>>>>>>>>>
// let MockData;
// const MockDataDir = `./test`;
// const MockDataFile = `rundown-repo.mock.json`;
// jest.mock(`./rundown-repo`, () =>
//   Object.assign(require.requireActual(`./rundown-repo`), {
//     getQuotes: jest.fn(() =>
//       jetpack.read(path.join(MockDataDir, MockDataFile), `json`)
//     )
//   })
// );

const testTable: TestTable = [
  [`input1`, `input2`, `expected value`], // standard params
  [{ paramA: `input1`, paramB: `input2` }, `expected value`]  // object-based params
];

// Jest cheatsheet ->  https://github.com/sapegin/jest-cheat-sheet/blob/master/Readme.md#matchers

// *** ASYNC!! Table driven testing  --  ASYNC!! ***
// test.each(testTable)(`rundownRepo(%p)`, (testValue, expectedValue) => {
//   return rundownRepo(testValue).then((testResult: any) => {
//     expect(testResult).toEqual(expectedValue);
//   });
// });

// Table driven testing  --  synchronous..
 test.each(testTable)(`rundownRepo(%p)`, (testValue, expectedValue) => {
   expect(rundownRepo(testValue)).toStrictEqual(expectedValue); // Object Deep Equal
   // expect(rundownRepo(testValue)).toMatch(expectedValue); //  String
   // expect(rundownRepo(testValue)).toBe(expectedValue); // strict equal, ie. ===
 });
