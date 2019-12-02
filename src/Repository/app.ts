const axios = require("axios");

axios({
  method: "GET",
  url: "https://therundown-therundown-v1.p.rapidapi.com/affiliates",
  headers: {
    "content-type": "application/octet-stream",
    "x-rapidapi-host": "therundown-therundown-v1.p.rapidapi.com",
    "x-rapidapi-key": "4bZ7pXP9QQJeORunAFeNEZS9pweBy0RK"
  }
})
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    console.log(error);
  });
