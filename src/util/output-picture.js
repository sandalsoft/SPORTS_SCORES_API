// @ts-nocheck
const jetpack = require("fs-jetpack");
const terminalImage = require("terminal-image");
const got = require("got");
const axios = require("axios");

const bufImg = `https://a.espncdn.com/i/teamlogos/nfl/500/buf.png`;
const localImg = `buffalo.png`;

const outputPicture = async url => {
  try {
    const { data } = await axios.get(url);
    console.log(`body.length: ${data.length}`);
    // const { body } = await got(url, { encoding: null });
    const imgBuffer = data; // body
    jetpack.write(localImg, imgBuffer);
    // console.log(await terminalImage.buffer(imgBuffer));
    localImage(localImg);
  } catch (error) {
    console.log(`error: ${error}`);
  }
};

const main = () => {
  outputPicture(bufImg);
  // localImage(localImg);
};

const localImage = async imagePath => {
  try {
    const imgBuffer = jetpack.read(imagePath, `buffer`);
    console.log(await terminalImage.buffer(imgBuffer));
  } catch (error) {
    console.log(`error: ${error}`);
  }
};

main();
