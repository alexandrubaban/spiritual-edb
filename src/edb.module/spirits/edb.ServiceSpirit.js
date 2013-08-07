/**
 * Spirit of the data service.
 * @see http://wiki.whatwg.org/wiki/ServiceRelExtension
 */
edb.ServiceSpirit = gui.Spirit.extend ({
	
	/**
	 * Default to accept JSON and fetch data immediately.
	 */
	onconstruct : function () {
		this._super.onconstruct ();
		var Type, type = this.att.get ( "type" );
		if ( type ) {
			Type = gui.Object.lookup ( type, this.window );
			if ( !Type ) {
				throw new TypeError ( "\"" + type + "\" is not a Type (in this context)." );
			}
		}
		if ( this.att.get ( "href" )) {
			new gui.Request ( this.element.href ).get ().then ( function ( status, data ) {
				type = ( function () {
					if ( Type ) {
						return new Type ( data );
					} else {
						switch ( gui.Type.of ( data )) {
							case "object" :
								return new edb.Object ( data );
							case "array" :
								return new edb.Array ( data );
						}
					}
				}());
				if ( type ) {
					this.output.dispatch ( type );
				} else {
					console.error ( "TODO: handle unhandled response type" );
				}
			}, this );
		} else if ( Type ) {
			this.output.dispatch ( new Type ());
		}
	}

	// /**
	//  * TODO: enable this pipeline stuff
	//  * @param {edb.Input} input
	//  */
	// oninput : function ( input ) {
	// 	this._super.oninput ( input );
	// 	if ( this.att.get ( "type" ) && this.input.done ) {
	// 		this._pipeline ();
	// 	}
	// },
	
	// PRIVATES ...............................................................................................
	
	/**
	 * If both input type and output type is specified, the service will automatically output new data when all 
	 * input is recieved. Input data will be supplied as constructor argument to output function; if A and B is 
	 * input types while C is output type, then input instance a and b will be output as new C ( a, b ) 
	 * @TODO Implement support for this some day :)
	 *
	_pipeline : function () {		
		console.error ( "TODO: might this be outdated???" );
		 *
		 * TODO: use method apply with array-like arguments substitute pending universal browser support.
		 * https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/apply#Description
		 *
		var data = new this.output._type (
			this._arg ( 0 ),
			this._arg ( 1 ),
			this._arg ( 2 ),
			this._arg ( 3 ),
			this._arg ( 4 ),
			this._arg ( 5 ),
			this._arg ( 6 ),
			this._arg ( 7 ),
			this._arg ( 8 ),
			this._arg ( 9 )
		);
		this.output.dispatch ( data );
	},
	
	 *
	 * Return data for index. Index follows the order of which the input handler was added, not in which data was recieved. 
	 * Alright, so this implies that first index will return object of type MyData if handler for this type was added first.
	 * @param {number} index
	 * @returns {object}
	 *
	_arg : function ( index ) {
		var type = this.input._types [ index ]; // function type
		return this.input.get ( type ); // instance of function
	}
	*/
});