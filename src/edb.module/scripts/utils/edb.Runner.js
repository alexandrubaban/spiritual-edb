/**
 * Script runner.
 */
edb.Runner = function Runner () {};

edb.Runner.prototype = {

	firstline : false,
	lastline : false,
	firstchar : false,
	lastchar : false,

	/**
	 * Run script.
	 * @param {edb.Compiler} compiler
	 * @param {String} script
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	run : function ( compiler, script, status, result ) {
		this._runlines ( compiler, script.split ( "\n" ), status, result );
	},

	/**
	 * Line text ahead equals given string?
	 * @param {String} string
	 * @returns {boolean}
	 */
	ahead : function ( string ) {
		var line = this._line;
		var index = this._index;
		var i = index + 1;
		var l = string.length;
		return line.length > index + l && line.substring ( i, i + l ) === string;
	},

	/**
	 * Line text behind equals given string?
	 * @param {String} line
	 * @param {number} index
	 * @param {String} string
	 * @returns {boolean}
	 */
	behind : function ( string ) {
		var line = this._line;
		var index = this._index;
		var length = string.length, start = index - length;
		return start >= 0 && line.substr ( start, length ) === string;
	},

	/**
	 * Get line string from current position.
	 * @returns {String}
	 */
	lineahead : function () {
		return this._line.substring ( this._index + 1 );
	},

	/**
	 * Space-stripped line text at index equals string?
	 * @param {String} string
	 * @returns {boolean}
	 */
	skipahead : function ( string ) {
		console.error ( "TODO" );
		/*
		line = line.substr ( index ).replace ( / /g, "" );
		return this._ahead ( line, 0, string );
		*/
	},

	// Private ..........................................................

	/**
	 * Current line string.
	 * @type {String}
	 */
	_line : null,

	/**
	 * Current character index.
	 * @type {number}
	 */
	_index : -1,

	/**
	 * Run all lines.
	 * @param {edb.Compiler} compiler
	 * @param {Array<String>} lines
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_runlines : function ( compiler, lines, status, result ) {
		var stop = lines.length - 1;
		lines.forEach ( function ( line, index ) {
			this.firstline = index === 0;
			this.lastline = index === stop;
			this._runline ( line, index, compiler, status, result );
		}, this );
	},

	/**
	 * Run single line.
	 * @param {String} line
	 * @param {number} index
	 * @param {edb.Compiler} compiler
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_runline : function ( line, index, compiler, status, result ) {
		line = this._line = line.trim ();
		if ( line.length ) {
			compiler.newline ( line, this, status, result );
			this._runchars ( compiler, line.split ( "" ), status, result );
			compiler.endline ( line, this, status, result );
		}
	},

	/**
	 * Run all chars.
	 * @param {edb.Compiler} compiler
	 * @param {Array<String>} chars
	 * @param {edb.Status} status
	 * @param {edb.Result} result
	 */
	_runchars : function ( compiler, chars, status, result ) {
		var stop = chars.length - 1;
		chars.forEach ( function ( c, i ) {
			this._index = i;
			this.firstchar = i === 0;
			this.lastchar = i === stop;
			compiler.nextchar ( c, this, status, result );
		}, this );
	}
};