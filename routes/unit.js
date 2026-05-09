const express = require('express');
const middleware = require("../middleware/middleware.js");
const Unit = require('../lib/models/Unit.js');
const redis = require('../lib/redis.js');
const multer = require('multer');
const shortid = require("shortid");
const fs = require('fs');
const path = require('path');

const UNITS_PATH = process.env.UNITS_PATH || '/units';
const VERBOSE = process.env.VERBOSE === 'true';


const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { token, dest } = req.body;

    // sanitize dest to prevent path traversal
    const safeDest = dest ? path.normalize(dest).replace(/^(\.\.[\/\\])+/, '') : '';
    const uploadPath = path.join(UNITS_PATH, token, safeDest);

    // make sure the final path is still inside UNITS_PATH
    if (!uploadPath.startsWith(UNITS_PATH)) {
      return cb(new Error('invalid destination path'));
    }
    if (!fs.existsSync(uploadPath)) {
      const altPath = uploadPath.endsWith('_disable')
        ? uploadPath.replace('_disable', '')
        : uploadPath + '_disable';
      if (fs.existsSync(altPath)) {
        uploadPath = altPath;
      }
    }

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// create the unit
router.post('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) return res.status(400).send({ msg: 'label is required' });

    const token = shortid.generate();
    const unit = await Unit.create({ label, mode: 'boot', token });

    // create folder structure on disk
    var unitPath = path.join(UNITS_PATH, token);
    fs.mkdirSync(unitPath, { recursive: true });
    unitPath = path.join(UNITS_PATH, token, "dropbox_disable");
    fs.mkdirSync(unitPath, { recursive: true });
    unitPath = path.join(UNITS_PATH, token, "hashcat_disable");
    fs.mkdirSync(unitPath, { recursive: true });
    unitPath = path.join(UNITS_PATH, token, "certs");
    fs.mkdirSync(unitPath, { recursive: true });
    unitPath = path.join(UNITS_PATH, token, "creds");
    fs.mkdirSync(unitPath, { recursive: true });
    unitPath = path.join(UNITS_PATH, token, "notes/Checklists/");
    fs.mkdirSync(unitPath, { recursive: true });

    if (VERBOSE) {
      console.log(`Created unit ${token} with boot mode set to default 'boot'.`);
      const unitPath = path.join(UNITS_PATH, token);
      const files = fs.existsSync(unitPath) ? fs.readdirSync(unitPath, { recursive: true }) : [];
      console.log(files);
    }
    return res.status(200).send({ label, mode: 'boot', token });
  } catch (e) {
    if (VERBOSE) {
      console.log(e)
    }
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// list all the unit. specify a unit with ?id=unit id this will list just one unit
router.get('/', middleware.isLoggedIn, async (req, res) => {
  try {
    if (req.query.id) {
      const units = await Unit.find({token: req.query.id});
      if (units.length != 1) return res.status(404).send({ msg: 'unit not found' });
      const unitPath = path.join(UNITS_PATH, units[0].token);
      const files = fs.existsSync(unitPath) ? fs.readdirSync(unitPath, { recursive: true }) : [];
      return res.status(200).send({ units, files });
    }
    const units = await Unit.find({});
    return res.status(200).send({ units });
  } catch (e) {
    if (VERBOSE) {
      console.log(e)
    }
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// update the specified unit
router.patch('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const { token, mode } = req.body;
    if (!token || !mode) return res.status(400).send({ msg: 'id and mode are required' });
    const units = await Unit.find({token: token});
    if (units.length != 1) return res.status(404).send({ msg: 'unit not found' });
    const validModes = ['dropbox', 'hashcat', 'boot'];
    if (!validModes.includes(mode)) return res.status(400).send({ msg: 'invalid mode' });
    const unitPath = path.join(UNITS_PATH, units[0].token);
    const folders = ['dropbox', 'hashcat'];

    for (const folder of folders) {
      const enabled = path.join(unitPath, folder);
      const disabled = path.join(unitPath, `${folder}_disable`);
      if (mode === folder) {
        // enable this folder
        if (fs.existsSync(disabled)) fs.renameSync(disabled, enabled);
      } else {
        // disable this folder
        if (fs.existsSync(enabled)) fs.renameSync(enabled, disabled);
      }
    }
    if (VERBOSE) {
      console.log(`Edit unit ${token} to boot mode '${mode}'.`);
      const unitPath = path.join(UNITS_PATH, units[0].token);
      const files = fs.existsSync(unitPath) ? fs.readdirSync(unitPath, { recursive: true }) : [];
      console.log(files);
    }
    await Unit.findByIdAndUpdate(units[0]._id, { mode });
    return res.status(200).send({ msg: 'unit updated', mode });
  } catch (e) {
    if (VERBOSE) {
      console.log(e)
    }
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// delete specified unit
router.delete('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).send({ msg: 'token is required' });
    const units = await Unit.find({ token });
    if (units.length != 1) {
      return res.status(404).send({ msg: 'unit not found' });
    }

    const unitPath = path.join(UNITS_PATH, token);
    if (fs.existsSync(unitPath)){
      fs.rmSync(unitPath, { recursive: true, force: true });
    }
    await Unit.findByIdAndDelete(units[0]._id);
    if (VERBOSE) {
      console.log(`Deleted unit ${token}`);
    }
    return res.status(200).send({ msg: 'unit deleted' });
  } catch (e) {
    if (VERBOSE) {
      console.log(e);
    }
    return res.status(500).send({ msg: 'internal server error' });
  }

});

// upload files to the unit
router.post('/upload', middleware.isLoggedIn, upload.single('file'), async (req, res) => {
  try {
    const { token, dest } = req.body;
    if (!token) return res.status(400).send({ msg: 'token is required' });
    const units = await Unit.find({ token });
    if (units.length != 1) return res.status(404).send({ msg: 'unit not found' });
    if (VERBOSE) console.log(`Uploaded ${req.file.originalname} to ${token}/${dest}`);
    return res.status(200).send({ msg: 'file uploaded', file: req.file.originalname });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }

});

// generate the one time JWT for download
router.post('/generate', middleware.isLoggedIn, async (req, res) => {
});

module.exports = router;
