const chalk = require("chalk");
const R = require("ramda");

const headersToSkip = [`timestamp`];
// const skipHeader = (value, index, arr) => {
//   if (!headersToSkip.includes(value)) {
//     return value;
//   }
// };
const pastCellFormat = cellValue => chalk.dim(cellValue);
const inProgressCellFormat = cellValue => chalk.yellow(cellValue);
const inFutureCellFormat = cellValue => chalk.white(cellValue);

const formatter = (cellValue, columnIndex, rowIndex, rowData, inputData) => {
  const row = inputData[rowIndex];
  var inProgressRegex = / Q\d /g;
  var matchedRegex = cellValue.match(inProgressRegex);
  if (matchedRegex) {
    return inProgressCellFormat(cellValue);
  }
  if (row.Status.includes(` F`)) {
    return pastCellFormat(cellValue);
  }
  return inFutureCellFormat(cellValue);
};
module.exports = {
  headers: [
    {
      value: "Date",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 24,
      formatter
    },
    {
      value: "Name",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 24,
      formatter
    },
    {
      value: "Line",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 24,
      formatter
    },
    {
      value: "O/U",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 7,
      formatter
    },
    {
      value: "Predicted Score",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 30,
      formatter
    },
    {
      value: "Status",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 24,
      formatter
    },
    {
      value: "Weather",
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: 38,
      formatter
    }
  ]
};
