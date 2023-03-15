const express = require("express");
const mongoose = require("mongoose");
const moment = require("moment");
require("dotenv").config();

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// TaskList model
const taskListSchema = new mongoose.Schema({
  name: String,
  description: String,
  active: Boolean,
});
const TaskList = mongoose.model("TaskList", taskListSchema);

// Task model
const taskSchema = new mongoose.Schema({
  taskName: String,
  description: String,
  dueDate: Date,
  period: String,
  periodType: {
    type: String,
    enum: ["monthly", "quarterly", "yearly"],
  },
  taskListId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TaskList",
  },
});
const Task = mongoose.model("Task", taskSchema);

// Create a task list
app.post("/api/createtasklist", async (req, res) => {
  try {
    const taskList = new TaskList(req.body);
    const result = await taskList.save();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a task
app.post("/api/createtask", async (req, res) => {
  try {
    const { taskName, description, dueDate, period, periodType, taskListId } =
      req.body;

    // Validate due date
    const endDate = moment(period, "MMM YYYY").endOf(periodType);
    if (moment(dueDate).isBefore(endDate)) {
      return res.status(400).json({
        error: "Due date should be after the end of the period",
      });
    }

    const task = new Task({
      taskName,
      description,
      dueDate: moment(dueDate, "DD-MM-YYYY").toISOString(),
      period,
      periodType,
      taskListId,
    });

    const result = await task.save();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List tasks
app.get("/api/tasklist", async (req, res) => {
  try {
    const { searchText, page = 1, limit = 10 } = req.query;

    const regex = new RegExp(searchText, "i");

    const tasks = await Task.find({
      $or: [{ taskName: regex }, { description: regex }],
    })
      .populate("taskListId", "name")
      .sort({ dueDate: "asc" })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const count = await Task.countDocuments({
      $or: [{ taskName: regex }, { description: regex }],
    });

    const results = tasks.map((task) => {
      return {
        taskName: task.taskName,
        description: task.description,
        periodType: task.periodType,
        period: task.period,
        dueDate: moment(task.dueDate).format("DD-MM-YYYY"),
        taskListName: task.taskListId.name,
      };
    });

    res.json({ count, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Connected on port: ${port}`));
