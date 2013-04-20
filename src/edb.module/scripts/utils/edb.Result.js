/**
 * Collecting compiler result.
 * @param @optional {String} text
 */
edb.Result = function Result ( text ) {
	this.body = text || "";
};

edb.Result.prototype = {

	/**
	 * Result body.
	 * @type {String}
	 */
	body : null,

	/**
	 * Mark the spot.
	 */
	mark : function () {
		this._spot = this.body.length - 1;
	},

	/**
	 * Generate poke at marked spot.
	 * @param {String} body
	 * @param {number} spot
	 * @param {String} func
	 * @returns {String}
	 */
	poke : function ( func, index, sig ) {
		sig = sig ?  ( ", &quot;" + sig + "&quot;" ) : "";
		var body = this.body;
		var spot = this._spot;
		var prev = body.substring ( 0, spot );
		var next = body.substring ( spot );
		this.body = prev + "\n" + 
			"var __edb__" + index + " = edb.Script.assign ( function ( value, checked ) { \n" +
			func + ";\n}, this );" + next +
			"edb.Script.register ( event ).invoke ( &quot;\' + __edb__" + index + " + \'&quot;" + sig + " );";
		this._spot = -1;
	},

	/**
	 * Generate and inject poke function into main function body.
	 * @param {String} body
	 * @param {number} spot
	 * @param {String} func
	 * @returns {String}
	 */
	_inject : function ( body, spot, func, index, sig ) {
		sig = sig ?  ( ", &quot;" + sig + "&quot;" ) : "";
		return (
			body.substring ( 0, spot ) + "\n" + 
			"var __edb__" + index + " = edb.Script.assign ( function ( value, checked ) { \n" +
			func + ";\n" +
			"}, this );" +
			body.substring ( spot ) +
			"edb.Script.register ( event ).invoke ( &quot;\' + __edb__" + index + " + \'&quot;" + sig + " );"
		);
	},

	/**
	 * Format result body.
	 * @TODO Indent switch cases
	 * @TODO Remove blank lines
	 * @param {String} body
	 * @returns {String}
	 */
	format : function ( body ) {
		var result = "";
		var tabs = "\t";
		var first = null;
		var last = null;
		var fixt = null;
		var flast = null;
		this.body.split ( "\n" ).forEach ( function ( line ) {
			line = line.trim ();
			first = line.charAt ( 0 );
			last = line.charAt ( line.length - 1 );
			fixt = line.split ( "//" )[ 0 ].trim ();
			flast = fixt.charAt ( fixt.length - 1 );
			if (( first === "}" || first === "]" ) && tabs !== "" ) {				
				tabs = tabs.slice ( 0, -1 );
			}
			result += tabs + line + "\n";
			if ( last === "{" || last === "[" || flast === "{" || flast === "[" ) {
				tabs += "\t";
			}
		});
		return result;
	},


	// Private ................................................................

	/**
	 * @type {number}
	 */
	_spot : -1,

	_poke : -1 // TODO: status.indx - bookkeep internally!
};