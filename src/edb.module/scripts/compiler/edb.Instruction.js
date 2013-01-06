/**
 * EDB processing instruction.
 * @param {String} pi
 */
edb.Instruction = function ( pi ) {

	this.atts = Object.create ( null );
	this.type = pi.split ( "<?" )[ 1 ].split ( " " )[ 0 ]; // TODO: regexp this
	var atexp = edb.Instruction._ATEXP;
	while (( hit = atexp.exec ( pi ))) {
		var n = hit [ 1 ], v = hit [ 2 ];
		this.atts [ n ] = gui.Type.cast ( v );
	}
};

/**
 * Identification.
 * @returns {String}
 */
edb.Instruction.prototype = {

	type : null, // instruction type
	atts : null, // instruction attributes
	toString : function () {
		return "[object edb.Instruction]";
	}
}


// STATICS .............................................................................

/**
 * Extract processing instructions from source.
 * @param {String} source
 * @returns {Array<edb.Instruction>}
 */
edb.Instruction.from = function ( source ) {

	var pis = [], pi = null, hit = null; 
	while (( hit = this._PIEXP.exec ( source ))) {
			pis.push ( new edb.Instruction ( hit [ 0 ]));
	}
	return pis;
}

/**
 * Remove processing instructions from source.
 * @param {String} source
 * @returns {String}
 */
edb.Instruction.clean = function ( source ) {

	return source.replace ( this._PIEXP, "" );
}

/**
 * @static
 * Math processing instruction.
 * @type {RegExp}
 */
edb.Instruction._PIEXP = /<\?.[^>?]+\?>/g;

/**
 * @static
 * Match attribute name and value.
 * @type {RegExp}
 */
edb.Instruction._ATEXP = /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/g;