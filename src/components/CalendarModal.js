import React, { useState } from 'react';
import './CalendarModal.css';

function CalendarModal({ isOpen, onClose, onDateSelect }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];

  const dayNames = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Aanpassen zodat maandag = 0
  const adjustedFirstDay = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

  const days = [];
  // Lege cellen voor dagen vóór de eerste dag van de maand
  for (let i = 0; i < adjustedFirstDay; i++) {
    days.push(null);
  }
  // Dagen van de maand
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }
  // Dagen van de volgende maand om de kalender compleet te maken
  const remainingDays = 42 - days.length; // 6 weken * 7 dagen
  for (let day = 1; day <= remainingDays && day <= 7; day++) {
    days.push(day);
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateClick = (day) => {
    if (day && day <= daysInMonth) {
      const date = new Date(year, month, day);
      setSelectedDate(date);
      if (onDateSelect) {
        onDateSelect(date);
      }
    }
  };

  const isToday = (day) => {
    if (!day || day > daysInMonth) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (day) => {
    if (!day || day > daysInMonth || !selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-header">
          <button className="btn-new-route-modal" onClick={onClose}>
            <span className="plus-icon">+</span>
            Nieuwe route
          </button>
        </div>

        <div className="calendar-wrapper">
          <div className="calendar">
            <div className="calendar-nav">
              <button className="nav-button" onClick={handlePrevMonth}>
                ←
              </button>
              <h3 className="calendar-month-year">
                {monthNames[month]} {year}
              </h3>
              <button className="nav-button" onClick={handleNextMonth}>
                →
              </button>
            </div>

            <div className="calendar-weekdays">
              {dayNames.map((day) => (
                <div key={day} className="weekday">
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-days">
              {days.map((day, index) => {
                const isCurrentMonth = day && day <= daysInMonth;
                const isPrevMonth = index < adjustedFirstDay;
                const isNextMonth = day && day > daysInMonth;

                return (
                  <div
                    key={index}
                    className={`calendar-day ${
                      !isCurrentMonth ? 'other-month' : ''
                    } ${isToday(day) ? 'today' : ''} ${
                      isSelected(day) ? 'selected' : ''
                    }`}
                    onClick={() => handleDateClick(day)}
                  >
                    {day && (
                      <span className="day-number">{day}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="calendar-footer">
          <p>Selecteer een datum om een route te maken of te openen</p>
        </div>
      </div>
    </div>
  );
}

export default CalendarModal;

