const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true })); // Middleware para manejar datos POST

app.use(express.json());

app.use(session({
  secret: 'faef132gfegagghg23',//cogigosecretoParafirmar las cookies de la sesion
  resave: false,
  saveUninitialized: true
}));
//mongodb
mongoose.connect('mongodb://127.0.0.1:27017/tecdigitalito', { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión a MongoDB:', err);
});

mongoose.connection.once('open', () => {
  console.log('Conexión a MongoDB establecida con éxito');
});

// Define el modelo de usuario para la colección "usuario"
const usuarioSchema = new mongoose.Schema({
  usuario: String,
  contrasena: String,
  nombre: String,
  fecha_nacimiento: Date,
  imagen: String,
}, { collection: 'usuario' }); 

const Usuario = mongoose.model('Usuario', usuarioSchema);

const cursoSchema = new mongoose.Schema({
  codigoCurso: String,
  nombreCurso: String,
  descripcion: String,
  fechaInicio: Date,
  fechaFin: Date,
  imagenCurso: String,
}, { collection: 'curso' }); 

const Curso = mongoose.model('Curso', cursoSchema);
//neo4j
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  "bolt://127.0.0.1:7687",
  neo4j.auth.basic("neo4j", "12345678")
);

//funciones
app.post('/procesar_registro', async (req, res) => {
  try {
    //mongodb
    const nuevoUsuario = new Usuario({
      usuario: req.body.usuario,
      contrasena: req.body.contrasena,
      nombre: req.body.nombre,
      fecha_nacimiento: req.body.fecha_nacimiento,
      imagen: req.body.avatar, // Cambié avatar a imagen para que coincida con el modelo de usuario
    });
    await nuevoUsuario.save();

    //neo4j
    try {
      const session = driver.session();
      const { usuario, nombre } = req.body; 
  
      const params = {
        username: usuario,
        nombre: nombre,
      };

    // Crea un nodo de usuario en Neo4j
    const result = await session.run(
      'CREATE (u:Usuario {username: $username, nombre: $nombre}) RETURN u',
      params 
    );
  
      session.close();
  
      // Redirige al usuario con el parámetro "registroExitoso=true"
      res.redirect('/registro.html?registroExitoso=true');
    } catch (error) {
      console.error('Error al crear el usuario en Neo4j:', error);
      res.status(500).json({ error: 'Error al crear el usuario en Neo4j' });
    }

  } catch (error) {
    console.error('Error al registrar el usuario en mongodb:', error);
    res.status(500).send('Error al registrar el usuario');
  }
});

app.post('/procesar_registroCurso', async (req, res) => {
  try {
    //mongodb
    const nuevoCurso = new Curso({
      codigoCurso: req.body.codigoCurso,
      nombre: req.body.nombreCurso,
      descripcion: req.body.descripcionCurso,
      fechaInicio: req.body.fechaInicio,
      fechaFin: req.body.fechaFin,
      imagenCurso: req.body.imagenCurso,
    });
    await nuevoCurso.save();

    const nombreUsuario = req.session.usuario.usuario;
    console.log(nombreUsuario)
    //neo4j
    try {
      const session = driver.session();
      const params = {
        codigoCurso: req.body.codigoCurso,
        nombre: req.body.nombreCurso,
        username: nombreUsuario,
      };

      // Crea un nodo de usuario en Neo4j
      const result = await session.run(
        'CREATE (u:Curso {codigoCurso: $codigoCurso, nombre: $nombre}) RETURN u',
        params 
      );

      // Crea una relación entre el usuario y el curso
      await session.run(
        'MATCH (u:Usuario {username: $username}), (c:Curso {codigoCurso: $codigoCurso}) ' +
        'CREATE (u)-[:Profesor]->(c)',
        params
      );
      session.close();
  
      const mensaje = "El curso se ha creado exitosamente.";

      res.send(
        `<script>
          alert("${mensaje}");
          window.location.href = '/menuProfesor.html';
        </script>`
      );
    } catch (error) {
      console.error('Error al crear el usuario en Neo4j:', error);
      res.status(500).json({ error: 'Error al crear el usuario en Neo4j' });
    }

  } catch (error) {
    console.error('Error al registrar el usuario:', error);
    res.status(500).send('Error al registrar el usuario');
  }
});


app.post('/procesar_login', async (req, res) => {
  try {
    
    const { usuario, contrasena } = req.body;

    const usuarioEncontrado = await Usuario.findOne({ usuario, contrasena });

    if (usuarioEncontrado) {
      
      req.session.usuario = usuarioEncontrado;

      res.redirect('/menu.html');
    } else {
      
      res.redirect('/index.html?loginError=true');
    }
  } catch (error) {
    console.error('Error al procesar el inicio de sesión:', error);
    res.status(500).send('Error al procesar el inicio de sesión');
  }
});


app.get('/obtenerCursos', async (req, res) => {
  try {
    const nombreUsuario = req.session.usuario.usuario;

    // Consulta Neo4j para obtener los cursos relacionados con el usuario
    const session = driver.session();
    const result = await session.run(
      'MATCH (u:Usuario {username: $username})-[:Profesor]->(c:Curso) RETURN c',
      { username: nombreUsuario }
    );
    session.close();

    const cursos = result.records.map(record => record.get('c').properties);

    // Envía la lista de cursos como respuesta en formato JSON
    res.json(cursos);
  } catch (error) {
    console.error('Error al obtener la lista de cursos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de cursos' });
  }
});

app.listen(port, () => {
  console.log(`Servidor Express en funcionamiento en el puerto ${port}`);
});
