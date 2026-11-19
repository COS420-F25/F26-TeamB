import React from 'react';
import { MDBCard, MDBCardBody, MDBBtn } from 'mdb-react-ui-kit';

const PLACEHOLDER_UPDATES = [
  { id: 1, timestamp: '2025-11-08 09:14', text: 'Drafted the outline myself before asking AI for feedback.' },
  { id: 2, timestamp: '2025-11-10 21:02', text: 'Caught an AI suggestion that was factually wrong before using it.' },
];

function SelectedGoalPane(): React.JSX.Element {
  return (
    <MDBCard className="goal-detail-card">
      <MDBCardBody className="goal-detail-body">
        <h1 className="goal-detail-title">Reduce reliance on AI for first drafts</h1>
        <p className="goal-detail-description">
          Write the first version of any assignment or project myself before consulting
          an AI tool, so I build and keep my own first-pass thinking skills.
        </p>

        <h3 className="goal-detail-subheading">Progress updates</h3>
        <div className="goal-update-scroll">
          <ul className="goal-update-list">
            {PLACEHOLDER_UPDATES.map((update) => (
              <li key={update.id} className="goal-update-item">
                <span className="goal-update-timestamp">{update.timestamp}</span>
                <p className="goal-update-text">{update.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="goal-update-form">
          <textarea
            className="goal-update-input"
            placeholder="Add a progress update..."
            rows={3}
          />
          <div className="goal-update-form-row">
            <input
              type="text"
              className="goal-update-timestamp-input"
              placeholder="Custom date/time (optional)"
            />
            <MDBBtn type="button" className="goal-config-cta-button">
              Add progress update
            </MDBBtn>
          </div>
        </div>
      </MDBCardBody>
    </MDBCard>
  );
}

export default SelectedGoalPane;
