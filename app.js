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
  nombre: String,
  descripcion: String,
  fechaInicio: Date,
  fechaFin: Date,
  imagenCurso: String,
}, { collection: 'curso' }); 

const Curso = mongoose.model('Curso', cursoSchema);

const temaSchema = new mongoose.Schema({
  nombreTema: String,
  descripcionTema: String,
}, { collection: 'tema' }); 

const Tema = mongoose.model('Tema', temaSchema);

const subtemaSchema = new mongoose.Schema({
  nombreSubtema: String,
  descripcionSubtema: String,
}, { collection: 'subtema' }); 

const SubTema = mongoose.model('Subtema', subtemaSchema);

const evaluacionSchema = new mongoose.Schema({
  nombre: String,
  preguntas: [{
      texto: String,
      respuestas: [{
          texto: String,
          correcta: Boolean
      }]
  }]
}, { collection: 'evaluaciones' });

const Evaluacion = mongoose.model('Evaluacion', evaluacionSchema);

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
      'CREATE (u:Usuario {username: $username}) RETURN u',
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

// Después del código que establece la sesión del usuario
app.get('/obtenerInformacionUsuario', async (req, res) => {
  try {
    const usuarioEnSesion = req.session.usuario;

    if (usuarioEnSesion) {
      // Consulta la información del usuario en MongoDB
      const usuarioInfo = await Usuario.findOne({ usuario: usuarioEnSesion.usuario });

      if (usuarioInfo) {

        // Puedes enviar la información del usuario como respuesta si es necesario
        res.json(usuarioInfo);
      } else {
        res.status(404).json({ error: 'Usuario no encontrado' });
      }
    } else {
      res.status(401).json({ error: 'No se ha iniciado sesión' });
    }
  } catch (error) {
    console.error('Error al obtener la información del usuario:', error);
    res.status(500).json({ error: 'Error al obtener la información del usuario' });
  }
});
// Agrega una nueva ruta para actualizar la información del usuario
app.post('/actualizarUsuario', async (req, res) => {
  try {
    const { usuario, contrasena, nombre, fecha_nacimiento, imagen } = req.body;

    // Actualiza la información del usuario en MongoDB
    await Usuario.findOneAndUpdate(
      { usuario: usuario },
      { contrasena, nombre, fecha_nacimiento, imagen },
      { new: true }
    );

    const mensaje = "Cambios guardados exitosamente.";

    // Envia una respuesta en formato JSON con un mensaje de éxito
    res.json({ mensaje });
  } catch (error) {
    console.error('Error al actualizar la información del usuario:', error);
    res.status(500).json({ error: 'Error al actualizar la información del usuario' });
  }
});

app.get('/obtenerUsuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, 'usuario'); // Consulta todos los usuarios y obtén solo el campo 'usuario'
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener la lista de usuarios:', error);
    res.status(500).json({ error: 'Error al obtener la lista de usuarios' });
  }
});
app.get('/obtenerInformacionUsuarioSeleccionado', async (req, res) => {
  try {
      const usuarioSeleccionado = req.query.usuario; // Obtén el nombre de usuario seleccionado

      // Aquí debes escribir la lógica para buscar la información del usuario seleccionado en la base de datos
      // y luego enviarla como respuesta en formato JSON
      // Por ejemplo, si estás usando MongoDB y Mongoose:
      const usuarioInfoSeleccionado = await Usuario.findOne({ usuario: usuarioSeleccionado });

      if (usuarioInfoSeleccionado) {
          res.json(usuarioInfoSeleccionado);
      } else {
          res.status(404).json({ mensaje: 'Usuario seleccionado no encontrado' });
      }
  } catch (error) {
      console.error('Error al obtener la información del usuario seleccionado:', error);
      res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});
app.get('/obtenerCurso', async (req, res) => {
  try {
    const nombreCurso = req.query.curso;

    // Consulta MongoDB para obtener los detalles del curso por su nombre
    const curso = await Curso.findOne({ nombre: nombreCurso });

    if (curso) {
      // Envía los detalles del curso como respuesta en formato JSON
      res.json(curso);
    } else {
      res.status(404).json({ error: 'Curso no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener los detalles del curso:', error);
    res.status(500).json({ error: 'Error al obtener los detalles del curso' });
  }
});

app.post('/crearTema', async (req, res) => {
  try {
    const codigoCurso = req.body['codigo-curso']; // Obtener el código del curso del formulario
    const nombreTema = req.body['nombre-tema'];
    const descripcionTema = req.body['descripcion-tema'];
    
    // Guardar la información del tema en MongoDB
    const nuevoTema = new Tema({
      nombreTema: nombreTema,
      descripcionTema: descripcionTema,
    });
    await nuevoTema.save();

    // Crear un nodo en Neo4j para el tema
    const session = driver.session();
    const params = {
      nombreTema: nombreTema,
      descripcionTema: descripcionTema,
    };
    await session.run(
      'CREATE (t:Tema {nombreTema: $nombreTema, descripcionTema: $descripcionTema})',
      params
    );

    // Crear una relación en Neo4j entre el curso y el tema
    await session.run(
      'MATCH (c:Curso {codigoCurso: $codigoCurso}), (t:Tema {nombreTema: $nombreTema}) ' +
      'CREATE (c)-[:Tema]->(t)',
      { codigoCurso: codigoCurso, nombreTema: nombreTema }
    );
    session.close();

    // Respuesta de éxito
    res.send('<script>alert("Tema creado exitosamente."); window.location.href = "/listaCursos.html";</script>');
  } catch (error) {
    console.error('Error al crear el tema:', error);
    res.status(500).json({ error: 'Error al crear el tema' });
  }
});

app.get('/obtenerTemasPorCurso', async (req, res) => {
  try {
    const codigoCurso = req.query.curso;

    // Consulta Neo4j para obtener los temas relacionados con el código del curso
    const session = driver.session();
    const result = await session.run(
      'MATCH (c:Curso {codigoCurso: $codigoCurso})-[:Tema]->(t:Tema) RETURN t',
      { codigoCurso: codigoCurso }
    );
    session.close();

    const temas = result.records.map(record => record.get('t').properties);

    // Envía la lista de temas como respuesta en formato JSON
    res.json(temas);
  } catch (error) {
    console.error('Error al obtener temas por curso:', error);
    res.status(500).json({ error: 'Error al obtener temas por curso' });
  }
});

app.post('/crearSubtema', async (req, res) => {
  try {
    const temaSeleccionado = req.body.temaSeleccionado;
    const nombreSubtema = req.body.nombreSubtema;
    const descripcionSubtema = req.body.descripcionSubtema;

    const nuevoSubtema = new SubTema({
      nombreSubtema: nombreSubtema,
      descripcionSubtema: descripcionSubtema,
    });
    await nuevoSubtema.save();

    // Crear un nodo en Neo4j para representar el subtema
    const session = driver.session();
    const params = {
      temaSeleccionado: temaSeleccionado,
      nombreSubtema: nombreSubtema,
      descripcionSubtema: descripcionSubtema,
    };
    await session.run(
      'CREATE (s:Subtema {nombreSubtema: $nombreSubtema, descripcionSubtema: $descripcionSubtema})',
      params
    );

    // Crear una relación en Neo4j entre el nodo del subtema y el nodo del tema seleccionado
    await session.run(
      'MATCH (t:Tema {nombreTema: $temaSeleccionado}), (s:Subtema {nombreSubtema: $nombreSubtema}) ' +
      'CREATE (t)-[:Subtema]->(s)',
      { temaSeleccionado: temaSeleccionado, nombreSubtema: nombreSubtema }
    );
    session.close();

    // Respuesta de éxito
    res.json({ success: true, message: 'Subtema creado exitosamente.' })
  } catch (error) {
    console.error('Error al crear el subtema:', error);
    res.status(500).json({ success: false, message: 'Error al crear el subtema.' });
  }
});

app.get('/obtenerDetallesTema', async (req, res) => {
  try {
      // Obtén el nombre del tema desde la consulta
      const nombreTema = req.query.tema;

      // Conecta con la base de datos de MongoDB y obtén los detalles del tema
      const tema = await Tema.findOne({ nombreTema: nombreTema });

      if (!tema) {
          return res.status(404).json({ message: 'Tema no encontrado' });
      }

      // Envia los detalles del tema como respuesta
      res.json(tema);
  } catch (error) {
      console.error('Error al obtener detalles del tema:', error);
      res.status(500).json({ message: 'Error al obtener detalles del tema' });
  }
});

app.get('/obtenerSubtemasPorTema', async (req, res) => {
  const nombreTema = req.query.tema;
  const session = driver.session();

  try {
      const result = await session.run(
          'MATCH (t:Tema {nombreTema: $nombreTema})-[:Subtema]->(s:Subtema) RETURN s',
          { nombreTema: nombreTema }
      );

      const subtemas = result.records.map(record => record.get('s').properties);
      console.log(subtemas)
      res.json(subtemas);
  } catch (error) {
      console.error('Error al obtener subtemas por tema:', error);
      res.status(500).json({ error: 'Error al obtener subtemas por tema' });
  } finally {
      session.close();
  }
});

app.get('/obtenerDetallesSubtema', async (req, res) => {
  try {
    // Obtén el nombre del subtema desde la consulta
    const nombreSubtema = req.query.nombreSubtema;

    // Busca el subtema en la base de datos
    const subtema = await SubTema.findOne({ nombreSubtema });

    if (!subtema) {
      return res.status(404).json({ message: 'Subtema no encontrado' });
    }

    // Envia los detalles del subtema como respuesta
    res.json(subtema);
  } catch (error) {
    console.error('Error al obtener detalles del subtema:', error);
    res.status(500).json({ message: 'Error al obtener detalles del subtema' });
  }
});

app.post("/guardarEvaluacionEnMongoDBYNeo4j", async (req, res) => {
  try {
    const evaluacion = req.body;
    // Guardar la evaluación en MongoDB
    const nuevaEvaluacion = new Evaluacion({
      nombre: evaluacion.nombre,
      preguntas: evaluacion.preguntas
    });
    await nuevaEvaluacion.save();

    console.log("Evaluación guardada exitosamente en MongoDB:", nuevaEvaluacion);

    // Conectarse a Neo4j
    const session = driver.session();

    // Crear un nodo de evaluación en Neo4j
    const crearEvaluacionCypher = `
      MATCH (curso:Curso {codigoCurso: $codigoCurso})
      CREATE (evaluacion:Evaluacion {nombre: $nombreEvaluacion})
      MERGE (curso)-[:Evaluacion]->(evaluacion)
    `;

    await session.run(crearEvaluacionCypher, {
      codigoCurso: req.query.curso.trim(),
      nombreEvaluacion: evaluacion.nombre
    });

    console.log("Evaluación guardada exitosamente en Neo4j.");

    // Cerrar la sesión de Neo4j
    session.close();

    res.json({ success: true, message: "Evaluación guardada exitosamente en MongoDB y Neo4j" });
  } catch (error) {
    console.error("Error al guardar la evaluación:", error);
    res.status(500).json({ error: "Error al guardar la evaluación" });
  }
});

app.get('/obtenerCursosEstudiantesMatriculados', async (req, res) => {
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
