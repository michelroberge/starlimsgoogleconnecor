// Configuration page of the STARLIMS Google Data Connecto
function getConfig(request) {
    var cc = DataStudioApp.createCommunityConnector();
    var config = cc.getConfig();

  if ( Utilities.formatDate(new Date(), "GMT+1", "yyyyMMdd") < "20200501"){
    config.newInfo()
        .setId('news0')
        .setText('V1 RELEASED - please use at your own risk, this is a "for fun" project that seems to work for me.');
  }
  
  // Labels at top of config page explaining how to get started
    config.newInfo()
        .setId('instructions1')
        .setText('The STARLIMS Google Data Connector package must be installed. GoogleDataConnector.* must be added to the HTTPServices in web.config');

    // SDP package is required on the STARLIMS server to work with this connector. This is the initial location from michel-roberge.com
    config.newInfo()
        .setId('requirements')
        .setText('Download and install the following STARLIMS Deployement Package:');

    config.newInfo()
        .setId('download')
        .setText('https://michel-roberge.com/files/GoogleDataConnector_v1.sdp');

    // Actually configuring a connection to STARLIMS following below instructions
    config.newInfo()
        .setId('instructions2')
        .setText('Enter STARLIMS Information (where do we get the data from?)');

    config.newTextInput()
        .setId('url')
        .setName('Enter STARLIMS URL')
        .setHelpText('e.g. https://www.starlims.com/mystarlimsapp/')
        .setPlaceholder('https://starlims.yourcompany.com/starlims11.dev/');

    config.newSelectSingle()
        .setId('selectPredefinedEntity')
        .setName('Select predefined STARLIMS Entity')
        .setHelpText('These are pre-built Queries in STARLIMS that are embeded with the GoogleDataConnector Library. If these fail, contact your STARLIMS Administrator to complete configuration.')
        .setAllowOverride(false)
        .addOption(config.newOptionBuilder().setLabel('Folders').setValue('folders'))
        .addOption(config.newOptionBuilder().setLabel('Samples').setValue('samples'))
        .addOption(config.newOptionBuilder().setLabel('Tests').setValue('tests'))
        .addOption(config.newOptionBuilder().setLabel('Chain of Custody').setValue('coc'));

    config
        .newInfo()
        .setId('overrideQBE')
        .setText('Leave the below field (QBE) empty to use the selected entity. Otherwise, the QBE will be used.');

    config.newTextInput()
        .setId('qbe')
        .setName('or user this QBE')
        .setHelpText('e.g. myCustomQBE')
        .setPlaceholder('Leave blank to use predefined entity.');

    config.setDateRangeRequired(false);

    return config.build();
}

// STARLIMS authentication is usually based on username and password, so the connector will leverage this mechanism
function getAuthType() {
    var cc = DataStudioApp.createCommunityConnector();
    return cc.newAuthTypeResponse()
        .setAuthType(cc.AuthType.USER_PASS)
        .build();
}

// required by connector (when password changes?)
function resetAuth() {
    var userProperties = PropertiesService.getUserProperties();
    userProperties.deleteProperty('dscc.username');
    userProperties.deleteProperty('dscc.password');
}

// Store entered credentials for the new connection. This is handled by google.
function setCredentials(request) {
    var userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('dscc.username', request.userPass.username);
    userProperties.setProperty('dscc.password', request.userPass.password);

    return {
        errorCode: 'NONE'
    };
}

// Required by Google. Assume that if there is a username and a password, they are valid since we don't know where STARLIMS will connect yet.
function isAuthValid() {
    var userProperties = PropertiesService.getUserProperties();
    return userProperties.getProperty('dscc.username') != null && userProperties.getProperty('dscc.password') != null;
};

// to switch off later when ready for production.
function isAdminUser() {
    return true;
}

// this function calls the STARLIMS server using STARLIMS Username and Password Authentication. This is used to check if credentials are good.
function login(url) {
    var s = UrlFetchApp.fetch(url + '/GoogleDataConnector.login.lims', getDefaultOptions());
    var o = JSON.parse(s);
    if (!o.valid) {
        Logger.log("Authentication failed for " + options.headers.STARLIMSUser + " on " + url);
    }
}

// Build the fields as defined by STARLIMS. This will need to be enhanced to support the correct aggregations and other attributes.
function getFields(schema) {
    var cc = DataStudioApp.createCommunityConnector();
    var fields = cc.getFields();
    var aggr = cc.AggregationType;
    schema.fields.forEach(function (item) {
        if (item.type == 'dimension') {
            fields.newDimension()
                .setId(item.name)
                .setName(item.text)
                .setType(cc.FieldType[item.dataType]);
        } else {
            fields.newMetric()
                .setId(item.name)
                .setName(item.text)
                .setType(cc.FieldType[item.dataType])
                .setAggregation(aggr.SUM);
        }
    });

    return fields;
}

// call STARLIMS to get the full schema (initial call)
function getSchema(request) {
  
    var options = getDefaultOptions();
    options.payload = JSON.stringify(request);
    var s = UrlFetchApp.fetch(request.configParams.url + '/GoogleDataConnector.getSchema.lims', options);
    var schema = JSON.parse(s);

    console.log({"key":  "schema", "value": schema});

    return {
        schema: getFields(schema).build()
    };
}

// this is the big one. Call STARLIMS, then rebuild schema based on user selection. Received data should already be narrowed down.
// eventually, we might need to implement caching of data to avoid server trips.
function getData(request) {

    login(request.configParams.url);
    var options = getDefaultOptions();
    options.payload = JSON.stringify(request);
    var response = UrlFetchApp.fetch(request.configParams.url + '/GoogleDataConnector.getData.lims', options);
    var parsedResponse = JSON.parse(response);


    var fields = getFields(parsedResponse.schema);
  
  
    var requestedFields = fields.forIds(
        request.fields.map(function (field) {          
            return field.name;
        })
    );

  
  var requestedSchema = requestedFields.build();
  

  return {
        schema: requestedSchema,
        rows: parsedResponse.rows
    };
}

// builds the header to authenticato to STARLIMS
function getDefaultOptions() {
    var user = PropertiesService.getUserProperties();
    var u = user.getProperty("dscc.username");
    if (u === null) {
        u = "-";
    }
    var p = user.getProperty("dscc.password");
    if (p === null) {
        p = "-";
    }
    return {
        headers: {
            STARLIMSUser: u,
            STARLIMSPass: p
        }
    };
}
