/**
 * Add support for data types.
 * @extends {edb.FunctionCompiler}
 */
edb.ScriptCompiler = edb.FunctionCompiler.extend ({

	/**
	 * Observed data types.
	 * @type {Map<String,String}
	 */
	inputs : null,

	/**
	 * Handle instruction.
	 */
	_instruct : function ( pi ) {

		this._super._instruct ( pi );
		var atts = pi.atts;
		switch ( pi.type ) {
			case "input" :
				this.inputs [ atts.name ] = atts.type;
				break;
		}
	},

	/**
	 * Compile script to invocable function.
	 * @param {Window} scope Function to be declared in scope of this window (or worker context).
	 * @param @optional {boolean} fallback
	 * @returns {function}
	 */
	compile : function ( scope, fallback ) {
		
		this.inputs = Object.create ( null );
		return this._super.compile ( scope, fallback );
	},

	/**
	 * 
	 * @param {String} script
	 * @returns {String}
	 */
	_declare : function ( script, head ) {

		this._super._declare ( script, head );

		var defs = [];

		gui.Object.each ( this.inputs, function ( name, type ) {
			head.declarations [ name ] = true;
			defs.push ( name + " = __input__.get ( " + type + " );\n" );
		}, this );

		if ( defs [ 0 ]) {
			head.definitions.push ( 
				"( function lookup ( __input__ ) {\n" +
				defs.join ( "" ) +
				"})( this.view.script.input );" 
			);
		}

		return script;
	}

});