"use client";

import { useState } from "react";
import { PAST_DATES, formatDate } from "./past-data";

interface Props {
  current: string;
  view: "my" | "kh";
}

const ASSET = "/sites/live4dresult-net-0600c55d/root-8a5edab2";
const CAL = ASSET + "/wp-content/themes/oldtheme-lottery-frontend/assets/images/icon/calendar.png?v=1";

export default function PastToolbar({ current, view }: Props) {
  const [open, setOpen] = useState(false);
  const idx = PAST_DATES.indexOf(current);
  const prev = idx > 0 ? PAST_DATES[idx - 1] : null;
  const next = idx >= 0 && idx < PAST_DATES.length - 1 ? PAST_DATES[idx + 1] : null;

  return (
    <>
      <div className="dark p-2 pl-3 mt-3 h5">Past Draw Result</div>
      <div className="text-center">
        <div className="btn-group btn-group-toggle">
          {prev ? (
            <a href={"/past-results/" + prev} className="text-white btn btn-secondary d-flex align-items-center">
              <i className="fa fa-arrow-left mr-2"></i> Prev
            </a>
          ) : (
            <a
              href="#"
              className="text-white btn btn-secondary d-flex align-items-center"
              onClick={(e) => {
                e.preventDefault();
                alert("There is no more result.");
              }}
            >
              <i className="fa fa-arrow-left mr-2"></i> Prev
            </a>
          )}
          <div style={{ position: "relative" }} className="d-inline-block">
            <label className="p-0 btn btn-primary d-flex align-items-center" style={{ marginBottom: 0, cursor: "pointer" }}>
              <input type="radio" name="options" autoComplete="off" readOnly />
              <img
                className="ui-datepicker-trigger btn btn-primary"
                src={CAL}
                alt="..."
                title="..."
                onClick={() => setOpen((v) => !v)}
              />
            </label>
            {open ? (
              <div
                className="dropdown-menu show text-left"
                style={{ position: "absolute", left: 0, top: "100%", zIndex: 2000, maxHeight: 320, overflowY: "auto" }}
              >
                {PAST_DATES.slice()
                  .reverse()
                  .map((d) => (
                    <a key={d} className="dropdown-item" href={"/past-results/" + d} onClick={() => setOpen(false)}>
                      {formatDate(d)}
                      {d === current ? " (current)" : ""}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
          {next ? (
            <a href={"/past-results/" + next} className="text-white btn btn-secondary d-flex align-items-center">
              Next <i className="fa fa-arrow-right ml-2"></i>
            </a>
          ) : (
            <a
              href="#"
              className="text-white btn btn-secondary d-flex align-items-center"
              onClick={(e) => {
                e.preventDefault();
                alert("There is no more result.");
              }}
            >
              Next <i className="fa fa-arrow-right ml-2"></i>
            </a>
          )}
        </div>
      </div>
      <div className="text-center mt-2">
        <div className="btn-group btn-group-toggle" id="country">
          <label
            className={"btn btn-danger" + (view === "my" ? " active" : "")}
            onClick={(e) => {
              e.preventDefault();
              if (view !== "my") window.location.href = "/past-results/" + current;
            }}
          >
            <input type="radio" name="options" id="selmy" value="1" style={{ position: "relative" }} checked={view === "my"} readOnly />
            Malaysia &amp; Singapore
          </label>
          <label
            className={"btn btn-danger" + (view === "kh" ? " active" : "")}
            onClick={(e) => {
              e.preventDefault();
              if (view !== "kh") window.location.href = "/past-results/" + current + "/cambodia";
            }}
          >
            <input type="radio" name="options" id="selcam" value="2" style={{ position: "relative" }} checked={view === "kh"} readOnly />
            Cambodia
          </label>
        </div>
      </div>
    </>
  );
}


