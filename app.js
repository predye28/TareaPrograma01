const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = 3000;

mongoose.connect('mongodb://127.0.0.1:27017/tecdigitalito', { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión a MongoDB:', err);
});

mongoose.connection.once('open', () => {
  console.log('Conexión a MongoDB establecida con éxito');
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true })); // Middleware para manejar datos POST

// Define el modelo de usuario para la colección "usuario"
const usuarioSchema = new mongoose.Schema({
  usuario: String,
  contrasena: String,
  nombre: String,
  fecha_nacimiento: Date,
  imagen: String,
}, { collection: 'usuario' }); 

const Usuario = mongoose.model('Usuario', usuarioSchema);

app.post('/procesar_registro', async (req, res) => {
  try {
    const nuevoUsuario = new Usuario({
      usuario: req.body.usuario,
      contrasena: req.body.contrasena,
      nombre: req.body.nombre,
      fecha_nacimiento: req.body.fecha_nacimiento,
      avatar: req.body.avatar,
    });

    await nuevoUsuario.save();

    // Redirige al usuario con el parámetro "registroExitoso=true"
    res.redirect('/registro.html?registroExitoso=true');

  } catch (error) {
    console.error('Error al registrar el usuario:', error);
    res.status(500).send('Error al registrar el usuario');
  }
});

// Nueva ruta para procesar el inicio de sesión
app.post('/procesar_login', async (req, res) => {
  try {
    // Obtén los valores de usuario y contraseña del formulario
    const { usuario, contrasena } = req.body;

    // Busca un usuario con las credenciales proporcionadas en la base de datos
    const usuarioEncontrado = await Usuario.findOne({ usuario, contrasena });

    if (usuarioEncontrado) {
      // Usuario válido, redirige al usuario a la página de "menu.html"
      res.redirect('/menu.html'); // Cambia '/menu.html' al URL de tu elección en la carpeta "public"
    } else {
      // Credenciales incorrectas, muestra un mensaje de error
      res.redirect('/index.html?loginError=true');
    }
  } catch (error) {
    console.error('Error al procesar el inicio de sesión:', error);
    res.status(500).send('Error al procesar el inicio de sesión');
  }
});


app.listen(port, () => {
  console.log(`Servidor Express en funcionamiento en el puerto ${port}`);
});
