const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true })); 

app.use(express.json());

app.use(session({
  secret: 'faef132gfegagghg23',
  resave: false,
  saveUninitialized: true
}));


mongoose.connect('mongodb://127.0.0.1:27017/tecdigitalito', { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on('error', (err) => {
  console.error('Error de conexión a MongoDB:', err);
});

mongoose.connection.once('open', () => {
  console.log('Conexión a MongoDB establecida con éxito');
});


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

const notasSchema = new mongoose.Schema({
  usuario: String,
  nombreCurso: String,
  nombreEvaluacion: String,
  notaFinal: String
}, { collection: 'notas' }); 

const Notas = mongoose.model('notas', notasSchema);


const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  "bolt://127.0.0.1:7687",
  neo4j.auth.basic("neo4j", "12345678")
);


app.post('/procesar_registro', async (req, res) => {
  try {
    
    const nuevoUsuario = new Usuario({
      usuario: req.body.usuario,
      contrasena: req.body.contrasena,
      nombre: req.body.nombre,
      fecha_nacimiento: req.body.fecha_nacimiento,
      imagen: req.body.avatar, 
    });
    await nuevoUsuario.save();

    
    try {
      const session = driver.session();
      const { usuario, nombre } = req.body; 
  
      const params = {
        username: usuario,
        nombre: nombre,
      };


    const result = await session.run(
      'CREATE (u:Usuario {username: $username}) RETURN u',
      params 
    );
  
      session.close();
  
    
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

    try {
      const session = driver.session();
      const params = {
        codigoCurso: req.body.codigoCurso,
        nombre: req.body.nombreCurso,
        username: nombreUsuario,
      };


      const result = await session.run(
        'CREATE (u:Curso {codigoCurso: $codigoCurso, nombre: $nombre}) RETURN u',
        params 
      );

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

 
    const session = driver.session();
    const result = await session.run(
      'MATCH (u:Usuario {username: $username})-[:Profesor]->(c:Curso) RETURN c',
      { username: nombreUsuario }
    );
    session.close();

    const cursos = result.records.map(record => record.get('c').properties);

    
    res.json(cursos);
  } catch (error) {
    console.error('Error al obtener la lista de cursos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de cursos' });
  }
});


app.get('/obtenerInformacionUsuario', async (req, res) => {
  try {
    const usuarioEnSesion = req.session.usuario;

    if (usuarioEnSesion) {

      const usuarioInfo = await Usuario.findOne({ usuario: usuarioEnSesion.usuario });

      if (usuarioInfo) {


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

app.post('/actualizarUsuario', async (req, res) => {
  try {
    const { usuario, contrasena, nombre, fecha_nacimiento, imagen } = req.body;

    
    await Usuario.findOneAndUpdate(
      { usuario: usuario },
      { contrasena, nombre, fecha_nacimiento, imagen },
      { new: true }
    );

    const mensaje = "Cambios guardados exitosamente.";

    res.json({ mensaje });
  } catch (error) {
    console.error('Error al actualizar la información del usuario:', error);
    res.status(500).json({ error: 'Error al actualizar la información del usuario' });
  }
});

app.get('/obtenerUsuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, 'usuario');
    res.json(usuarios);
  } catch (error) {
    console.error('Error al obtener la lista de usuarios:', error);
    res.status(500).json({ error: 'Error al obtener la lista de usuarios' });
  }
});
app.get('/obtenerInformacionUsuarioSeleccionado', async (req, res) => {
  try {
      const usuarioSeleccionado = req.query.usuario; 

  
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

  
    const curso = await Curso.findOne({ nombre: nombreCurso });

    if (curso) {

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
    const codigoCurso = req.body['codigo-curso']; 
    const nombreTema = req.body['nombre-tema'];
    const descripcionTema = req.body['descripcion-tema'];
    
    
    const nuevoTema = new Tema({
      nombreTema: nombreTema,
      descripcionTema: descripcionTema,
    });
    await nuevoTema.save();

    const session = driver.session();
    const params = {
      nombreTema: nombreTema,
      descripcionTema: descripcionTema,
    };
    await session.run(
      'CREATE (t:Tema {nombreTema: $nombreTema, descripcionTema: $descripcionTema})',
      params
    );


    await session.run(
      'MATCH (c:Curso {codigoCurso: $codigoCurso}), (t:Tema {nombreTema: $nombreTema}) ' +
      'CREATE (c)-[:Tema]->(t)',
      { codigoCurso: codigoCurso, nombreTema: nombreTema }
    );
    session.close();


    res.send('<script>alert("Tema creado exitosamente."); window.location.href = "/listaCursos.html";</script>');
  } catch (error) {
    console.error('Error al crear el tema:', error);
    res.status(500).json({ error: 'Error al crear el tema' });
  }
});

app.get('/obtenerTemasPorCurso', async (req, res) => {
  try {
    const codigoCurso = req.query.curso;

    
    const session = driver.session();
    const result = await session.run(
      'MATCH (c:Curso {codigoCurso: $codigoCurso})-[:Tema]->(t:Tema) RETURN t',
      { codigoCurso: codigoCurso }
    );
    session.close();

    const temas = result.records.map(record => record.get('t').properties);

    
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

    
    await session.run(
      'MATCH (t:Tema {nombreTema: $temaSeleccionado}), (s:Subtema {nombreSubtema: $nombreSubtema}) ' +
      'CREATE (t)-[:Subtema]->(s)',
      { temaSeleccionado: temaSeleccionado, nombreSubtema: nombreSubtema }
    );
    session.close();

    
    res.json({ success: true, message: 'Subtema creado exitosamente.' })
  } catch (error) {
    console.error('Error al crear el subtema:', error);
    res.status(500).json({ success: false, message: 'Error al crear el subtema.' });
  }
});

app.get('/obtenerDetallesTema', async (req, res) => {
  try {
      
      const nombreTema = req.query.tema;

      
      const tema = await Tema.findOne({ nombreTema: nombreTema });

      if (!tema) {
          return res.status(404).json({ message: 'Tema no encontrado' });
      }

      
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
   
    const nombreSubtema = req.query.nombreSubtema;

    
    const subtema = await SubTema.findOne({ nombreSubtema });

    if (!subtema) {
      return res.status(404).json({ message: 'Subtema no encontrado' });
    }

    res.json(subtema);
  } catch (error) {
    console.error('Error al obtener detalles del subtema:', error);
    res.status(500).json({ message: 'Error al obtener detalles del subtema' });
  }
});

app.post("/guardarEvaluacionEnMongoDBYNeo4j", async (req, res) => {
  try {
    const evaluacion = req.body;
    
    const nuevaEvaluacion = new Evaluacion({
      nombre: evaluacion.nombre,
      preguntas: evaluacion.preguntas
    });
    await nuevaEvaluacion.save();

    console.log("Evaluación guardada exitosamente en MongoDB:", nuevaEvaluacion);


    const session = driver.session();


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

    const session = driver.session();
    const result = await session.run(
      'MATCH (u:Usuario {username: $username})<-[:Estudiante]-(c:Curso) RETURN c',
      { username: nombreUsuario }
    );
    session.close();

    const cursos = result.records.map(record => record.get('c').properties);

    res.json(cursos);
  } catch (error) {
    console.error('Error al obtener la lista de cursos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de cursos' });
  }
});


app.get('/obtenerCursosEstudiante', async (req, res) => {
  try {
    const nombreUsuario = req.session.usuario.usuario;

    const session = driver.session();
    const neo4jProfesorResult = await session.run(
      'MATCH (u:Usuario {username: $username})-[:Profesor]->(cursosProfesor:Curso) RETURN cursosProfesor',
      { username: nombreUsuario }
    );

    const neo4jEstudianteResult = await session.run(
      'MATCH (u:Usuario {username: $username})<-[:Estudiante]-(cursosEstudiante:Curso) RETURN cursosEstudiante',
      { username: nombreUsuario }
    );

    session.close();

    const cursosProfesor = neo4jProfesorResult.records.map(record => record.get('cursosProfesor').properties);
    const cursosEstudiante = neo4jEstudianteResult.records.map(record => record.get('cursosEstudiante').properties);


    const cursosMongo = await Curso.find({}).exec();

    const cursosNoProfesorEstudiante = cursosMongo.filter(curso => {

      return !cursosProfesor.some(cursoProfesor => cursoProfesor.nombre === curso.nombre) &&
             !cursosEstudiante.some(cursoEstudiante => cursoEstudiante.nombre === curso.nombre);
    });

    res.json(cursosNoProfesorEstudiante);
  } catch (error) {
    console.error('Error al obtener la lista de cursos no relacionados:', error);
    res.status(500).json({ error: 'Error al obtener la lista de cursos no relacionados' });
  }
});


app.post('/matricularCurso', async (req, res) => {
  try {
    const nombreUsuario = req.session.usuario.usuario;
    const nombreCurso = req.body.cursoNombre; 

    const session = driver.session();
    await session.run(
      'MATCH (u:Usuario {username: $username}), (c:Curso {nombre: $cursoNombre}) ' +
      'CREATE (c)-[:Estudiante]->(u)',
      { username: nombreUsuario, cursoNombre: nombreCurso }
    );
    session.close();

    res.status(200).json({ mensaje: 'Curso matriculado exitosamente' });
  } catch (error) {
    console.error('Error al matricular al estudiante en el curso:', error);
    res.status(500).json({ error: 'Error al matricular al estudiante en el curso' });
  }
});

app.get('/obtenerNombresEstudiantesPorCurso', async (req, res) => {
  try {
    const nombreCurso = req.query.curso.trim(); 
      console.log(nombreCurso)
      
      const session = driver.session();
      const neo4jResult = await session.run(
          'MATCH (curso:Curso {nombre: $nombreCurso})-[:Estudiante]->(estudiante:Usuario) RETURN estudiante.username',
          { nombreCurso }
      );
      session.close();

      const nombresEstudiantes = neo4jResult.records.map(record => record.get('estudiante.username'));
      console.log(nombresEstudiantes)
      res.json(nombresEstudiantes);
  } catch (error) {
      console.error('Error al obtener la lista de nombres de estudiantes matriculados por curso:', error);
      res.status(500).json({ error: 'Error al obtener la lista de nombres de estudiantes matriculados por curso' });
  }
});


app.get('/obtenerDetallesCurso', async (req, res) => {
  try {
      const nombreCurso = req.query.curso.trim(); 
      const curso = await Curso.findOne({ nombre: nombreCurso });

      if (!curso) {
          res.status(404).json({ mensaje: 'Curso no encontrado' });
          return;
      }

      res.json(curso);

  } catch (error) {
      console.error('Error al obtener los detalles del curso:', error);
      res.status(500).json({ error: 'Error al obtener los detalles del curso' });
  }
});

app.get('/obtenerEvaluaciones', async (req, res) => {
  try {
      const codigoCurso = req.query.curso.trim(); 
      const session = driver.session();
      const result = await session.run(
          `
          MATCH (c:Curso {codigoCurso: $codigoCurso})-[:Evaluacion ]->(e:Evaluacion)
          RETURN e.nombre AS nombre
          `,
          { codigoCurso }
      );

      const evaluaciones = result.records.map(record => record.get('nombre'));

      session.close();

      res.json(evaluaciones);
  } catch (error) {
      console.error('Error al obtener evaluaciones desde Neo4j:', error);
      res.status(500).json({ error: 'Error al obtener evaluaciones desde Neo4j' });
  }
});

app.get('/obtenerNotas', async (req, res) => {
  try {
      const nombreEvaluacion = req.query.nombreEvaluacion;
      const usuario = req.session.usuario.usuario; 

      const notas = await Notas.find({ usuario, nombreEvaluacion });

      res.json(notas);
  } catch (error) {
      console.error('Error al obtener notas desde MongoDB:', error);
      res.status(500).json({ error: 'Error al obtener notas desde MongoDB' });
  }
});

app.get('/obtenerEvaluacion', async (req, res) => {
  try {
      const nombreEvaluacion = req.query.nombreEvaluacion.trim();
      
      const evaluacion = await Evaluacion.findOne({ nombre: nombreEvaluacion });

      if (!evaluacion) {
          res.status(404).json({ mensaje: 'Evaluación no encontrada' });
          return;
      }

      res.json(evaluacion);

  } catch (error) {
      console.error('Error al obtener los detalles de la evaluación:', error);
      res.status(500).json({ error: 'Error al obtener los detalles de la evaluación' });
  }
});

app.post('/guardarNotaFinal', async (req, res) => {
  try {
      const nombreEvaluacion = req.query.nombreEvaluacion;
      const codigoCurso = req.body.codigoCurso;
      const notaFinal = req.body.notaFinal;

      const nombreUsuario = req.session.usuario.usuario;

      const nuevaNota = new Notas({
          usuario: nombreUsuario,
          nombreCurso: codigoCurso,
          nombreEvaluacion: nombreEvaluacion,
          notaFinal: notaFinal.toString()
      });

      await nuevaNota.save();

      console.log(`Nota final de la evaluación "${nombreEvaluacion}" guardada para el usuario "${nombreUsuario}": ${notaFinal}`);
      res.status(200).json({ mensaje: 'Nota final guardada con éxito' });
  } catch (error) {
      console.error('Error al guardar la nota final:', error);
      res.status(500).json({ error: 'Error al guardar la nota final' });
  }
});


app.listen(port, () => {
  console.log(`Servidor Express en funcionamiento en el puerto ${port}`);
});
