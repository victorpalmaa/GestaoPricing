class GenerateSW {
  constructor(options = {}) {
    this.options = options;
  }
  apply(compiler) {}
}

class InjectManifest {
  constructor(options = {}) {
    this.options = options;
  }
  apply(compiler) {}
}

module.exports = { GenerateSW, InjectManifest };