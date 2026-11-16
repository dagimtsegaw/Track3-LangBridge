import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export function createStore(file) {
  let chain = Promise.resolve();
  function run(fn) {
    const next = chain.then(fn, fn);
    chain = next.then(
      function () {},
      function () {}
    );
    return next;
  }
  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  function write(list) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
    fs.renameSync(tmp, file);
  }
  return {
    create(ticket) {
      return run(function () {
        const list = read();
        list.push(ticket);
        write(list);
        return ticket;
      });
    },
    waiting() {
      return run(function () {
        return read().filter(function (ticket) {
          return ticket && ticket.status === "waiting";
        });
      });
    },
    answer(id, note) {
      return run(function () {
        const list = read();
        const ticket = list.find(function (item) {
          return item && item.ticketId === id;
        });
        if (!ticket) return null;
        ticket.status = "answered";
        ticket.note = note;
        ticket.answeredAt = new Date().toISOString();
        write(list);
        return ticket;
      });
    },
  };
}

export function newTicketId() {
  return "db-" + randomBytes(6).toString("hex");
}
