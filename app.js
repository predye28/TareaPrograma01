const express = require('express');
const app = express();
const port = 3000; // Puerto en el que se ejecutará tu servidor

app.use(express.static(__dirname + '/public')); 




app.listen(port, () => {
  console.log(`Servidor Express en funcionamiento en el puerto ${port}`);
});