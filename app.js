const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const app = express();
const jwt = require("jsonwebtoken");
const path = require("path");

app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const convertDbObjectTOServerObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectTOServerObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

// login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
// GET States API 2
app.get("/states/", authenticationToken, async (request, response) => {
  const selectStatesQuery = `
SELECT * FROM state;`;
  const statesArray = await db.all(selectStatesQuery);
  response.send(
    statesArray.map((eachState) => convertDbObjectTOServerObject(eachState))
  );
});
// GET StateId API 3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const state = await db.get(selectStateQuery);
  response.send(convertDbObjectTOServerObject(state));
});

//POST districts API 4
///*
app.post("/districts/", authenticationToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
INSERT INTO 
district (state_id,district_name,cases,cured,active,deaths)
VALUES 
(${stateId} , '${districtName}',${cases}, ${cured} , ${active}, ${deaths}  );`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// GET /districts/:districtId/ API 5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictIdQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const districtArray = await db.get(selectDistrictIdQuery);
    response.send(convertDistrictDbObjectTOServerObject(districtArray));
  }
);

//DELETE /districts/:districtId/ API 6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// PUT /districts/:districtId/ API 7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putDistrictQuery = `
    UPDATE district 
    SET
    
        
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}

    
    WHERE district_id = ${districtId};`;
    await db.run(putDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET /states/:stateId/stats/ API 8

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatusQuery = `
    SELECT 
    SUM(cases) AS totalCases ,
    SUM(cured) AS totalCured ,
    SUM(active) As totalActive ,
    SUM(deaths) AS totalDeaths
    FROM 
    district 
    WHERE state_id = ${stateId};`;
    const totalStatusArray = await db.get(getStatusQuery);
    response.send(totalStatusArray);
  }
);

module.exports = app;
