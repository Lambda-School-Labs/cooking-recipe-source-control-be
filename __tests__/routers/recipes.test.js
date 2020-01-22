const recipes_router = require("../../endpoints/routers/recipes");
const recipes_model = require("../../endpoints/models/recipes");
const validate = require("../../endpoints/middleware/validate");
// This test does not care about middleware.
// Anytime we call a middleware function, just call next()
jest.mock("../../endpoints/middleware/validate", () => {
  return {
    user: (req, res, next) => next(),
    token: (req, res, next) => {
      req.user = { id: 1 };
      next();
    },
    admin: (req, res, next) => next(),
    recipe: (req, res, next) => {
      res.locals.recipe = req.body;
      next();
    },
    user_recipe: (req, res, next) => next()
  };
});

// Set up our test server
const request = require("supertest");
const express = require("express");
const server = express();
server.use(express.json());
server.use(recipes_router);

test("We are in the test environment", () => {
  const env = process.env.DB_ENVIRONMENT;
  expect(env).toBe("testing");
});

describe('POST "/recipes"', () => {
  test("Returns 200 if successful", async () => {
    recipes_model.add_one = jest.fn(
      req_obj =>
        new Promise(res => {
          setTimeout(() => res({ ...req_obj, test: true }), 0);
        })
    );
    const new_recipe = {
      title: "John",
      prep_time: 45,
      ingredients: ["matcha"],
      instructions: ["cook"]
    };
    const expected_recipe = {
      ...new_recipe,
      owner_id: 1, // From our mocked middleware token()
      test: true
    };

    const response = await request(server)
      .post("/recipes")
      .send(new_recipe)
      .set("Accept", "application/json");

    expect(response.status).toEqual(200);
    expect(response.body).toEqual(expected_recipe);
    expect(recipes_model.add_one).toHaveBeenCalledTimes(1);
    recipes_model.add_one.mockReset();
  });

  test("Returns 500 if unsuccessful", async () => {
    recipes_model.add_one = jest.fn(() => {
      throw { message: "error" };
    });
    const expected_error = { message: "error" };
    const new_recipe = {
      title: "John",
      prep_time: 45,
      ingredients: ["matcha"],
      instructions: ["cook"]
    };

    const response = await request(server)
      .post("/recipes")
      .send(new_recipe)
      .set("Accept", "application/json");

    expect(response.status).toEqual(500);
    expect(response.body).toEqual(expected_error);
    expect(recipes_model.add_one).toHaveBeenCalledTimes(1);
    recipes_model.add_one.mockReset();
  });

  test("returns 400 if there's a custom error", async () => {
    recipes_model.add_one = jest.fn(() => {
      throw { userError: true, message: "error" };
    });
    const expected_error = { userError: true, message: "error" };
    const new_recipe = {
      title: "John",
      prep_time: 45,
      ingredients: ["matcha"],
      instructions: ["cook"]
    };

    const response = await request(server)
      .post("/recipes")
      .send(new_recipe)
      .set("Accept", "application/json");

    expect(response.status).toEqual(400);
    expect(response.body).toEqual(expected_error);
    expect(recipes_model.add_one).toHaveBeenCalledTimes(1);
    recipes_model.add_one.mockReset();
  });
});

describe('GET "/recipes/:id"', () => {
  test("Returns 200 if successful", async () => {
    recipes_model.get_one = jest.fn(
      id_obj =>
        new Promise(res => {
          setTimeout(() => res({ id: Number(id_obj.id), test: true }), 0);
        })
    );
    const expected_recipe = {
      id: 1, // We will test for recipe id 1
      test: true
    };

    const response = await request(server).get("/recipes/1");

    expect(response.status).toEqual(200);
    expect(response.body).toEqual(expected_recipe);
    expect(recipes_model.get_one).toHaveBeenCalledTimes(1);
    recipes_model.get_one.mockReset();
  });

  test("Returns 404 if the model returns nothing", async () => {
    recipes_model.get_one = jest.fn(() => null);
    const expected_error = /no recipe/i;

    const response = await request(server).get("/recipes/1");

    expect(response.status).toEqual(404);
    expect(response.body).toMatch(expected_error);
    expect(recipes_model.get_one).toHaveBeenCalledTimes(1);
    recipes_model.get_one.mockReset();
  });

  test("returns 500 if unsuccessful", async () => {
    recipes_model.get_one = jest.fn(() => {
      throw { detail: "error" };
    });
    // res.status(500).json(err.detail)
    //                       ↓↓↓
    const expected_error = /error/i;

    const response = await request(server).get("/recipes/1");

    expect(response.status).toEqual(500);
    expect(response.body).toMatch(expected_error);
    expect(recipes_model.get_one).toHaveBeenCalledTimes(1);
    recipes_model.get_one.mockReset();
  });
});

describe('GET "/recipes"', () => {
  // We will use this fake_db in our tests
  const fake_db = [
    { title: "test1", test: true },
    { title: "test2", test: true },
    { title: "test22", test: true },
    { title: "test3", test: true }
  ];
  test("returns 200 if no search is given", async () => {
    recipes_model.get_all = jest.fn(
      title_search =>
        new Promise(res => {
          setTimeout(
            // Actually filter the fake_db to emulate a search
            () => res(fake_db.filter(obj => obj.title.match(title_search))),
            0
          );
        })
    );
    // We should return all of our database on an empty search
    const expected_recipes = fake_db;

    const response = await request(server).get("/recipes");

    expect(response.status).toEqual(200);
    expect(response.body).toEqual(expected_recipes);
    expect(recipes_model.get_all).toHaveBeenCalledTimes(1);
    recipes_model.get_all.mockReset();
  });
  test("Returns 200 if search is successful", async () => {
    recipes_model.get_all = jest.fn(
      title_search =>
        new Promise(res => {
          setTimeout(
            // Actually filter the fake_db to emulate a search
            () => res(fake_db.filter(obj => obj.title.match(title_search))),
            0
          );
        })
    );
    const expected_recipes = [
      { title: "test2", test: true },
      { title: "test22", test: true }
    ];

    const response = await request(server).get("/recipes?title=t2");

    expect(response.status).toEqual(200);
    expect(response.body).toEqual(expected_recipes);
    expect(recipes_model.get_all).toHaveBeenCalledTimes(1);
    recipes_model.get_all.mockReset();
  });

  test("Returns 404 if the model returns an empty array", async () => {
    recipes_model.get_all = jest.fn(() => []);
    const expected_error = /no recipe/i;

    const response = await request(server).get("/recipes");

    expect(response.status).toEqual(404);
    expect(response.body).toMatch(expected_error);
    expect(recipes_model.get_all).toHaveBeenCalledTimes(1);
    recipes_model.get_all.mockReset();
  });

  test("returns 500 if unsuccessful", async () => {
    recipes_model.get_all = jest.fn(() => {
      throw { detail: "error" };
    });
    // res.status(500).json(err.detail)
    //                       ↓↓↓
    const expected_error = /error/i;

    const response = await request(server).get("/recipes");

    expect(response.status).toEqual(500);
    expect(response.body).toMatch(expected_error);
    expect(recipes_model.get_all).toHaveBeenCalledTimes(1);
    recipes_model.get_all.mockReset();
  });
});

describe("PUT /recipes/:id", () => {
  test("Returns 200 if successful", async () => {
      
  });
});