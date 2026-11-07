"use client";

import { useState } from "react";
import { PAST_DATES, formatDateWithDay } from "./past-data";

interface Props {
  current: string;
  view: "my" | "kh";
  dates?: string[];
}

const ASSET = "/sites/mkt88/app";
const CAL = ASSET + "/theme-assets/images/icon/calendar.png?v=1";

export default function PastToolbar({ current, view, dates: suppliedDates }: Props) {
  const [open, setOpen] = useState(false);
  const dates = suppliedDates?.length ? suppliedDates : PAST_DATES;

  return (
    <>
      <div className="dark p-2 pl-3 mt-3 h5">Past Draw Result</div>
      <div className="text-center">
        <div className="btn-group btn-group-toggle">
          <div style={{ position: "relative" }} className="d-inline-block">
            <label className="p-0 btn btn-primary d-flex align-items-center" style={{ marginBottom: 0, cursor: "pointer" }}>
              <input type="radio" name="options" autoComplete="off" readOnly />
              <img loading="lazy"
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
                <div className="px-2 pb-2">
                  <input
                    type="date"
                    aria-label="Choose past result date"
                    value={current}
                    min={dates[0]}
                    max={dates[dates.length - 1]}
                    onChange={(e) => {
                      if (e.target.value) window.location.href = "/past-results/" + e.target.value + (view === "kh" ? "/cambodia" : "");
                    }}
                    style={{ width: "100%", minHeight: 40, padding: "6px 8px" }}
                  />
                </div>
                {dates.slice(-120)
                  .reverse()
                  .map((d) => (
                    <a key={d} className="dropdown-item" href={"/past-results/" + d} onClick={() => setOpen(false)}>
                      {formatDateWithDay(d)}
                      {d === current ? " (current)" : ""}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
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
            Malaysia &amp; Singapore 马来西亚·新加坡
          </label>
          <label
            className={"btn btn-danger" + (view === "kh" ? " active" : "")}
            onClick={(e) => {
              e.preventDefault();
              if (view !== "kh") window.location.href = "/past-results/" + current + "/cambodia";
            }}
          >
            <input type="radio" name="options" id="selcam" value="2" style={{ position: "relative" }} checked={view === "kh"} readOnly />
            Cambodia 柬埔寨
          </label>
        </div>
      </div>
    </>
  );
}



