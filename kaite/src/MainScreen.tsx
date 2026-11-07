import React from 'react';
import {
  MDBContainer,
  MDBRow,
  MDBCol,
  MDBCard,
  MDBCardBody,
  MDBBtn,
  MDBIcon,
  MDBNavbar,
  MDBNavbarBrand,
  MDBNavbarNav,
  MDBNavbarItem,
  MDBNavbarLink,
  MDBBadge,
  MDBInputGroup,
} from 'mdb-react-ui-kit';
import './MainScreen.css';

interface ChatMessage {
  id: string;
  sender: 'kaite' | 'you';
  text: string;
}

interface Testimonial {
  id: string;
  tag: string;
  quote: string;
  initials: string;
  name: string;
  role: string;
}

// Placeholder data matching the mockup - no real conversation/reflection
// logic is wired up yet.
const PLACEHOLDER_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    sender: 'kaite',
    text:
      'Over the past week you opened an AI tool 23 times, mostly late in the evening. What was usually going on right before you reached for it?',
  },
  {
    id: '2',
    sender: 'you',
    text: 'Usually I was stuck on an assignment and just wanted to get unstuck fast.',
  },
  {
    id: '3',
    sender: 'kaite',
    text:
      'That makes sense. Looking back, which of those moments felt like AI helped you think - and which felt like it did the thinking for you?',
  },
  {
    id: '4',
    sender: 'you',
    text: 'Honestly, the quick fixes did the thinking for me.',
  },
  {
    id: '5',
    sender: 'kaite',
    text:
      "That's a useful thing to notice. What's one small change you could try the next time you feel stuck - before you open an AI tool?",
  },
  {
    id: '6',
    sender: 'you',
    text:
      'Maybe give it ten minutes on my own first, then ask AI to check my approach instead of solving it.',
  },
];

const PLACEHOLDER_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    tag: 'Weekly reflection routine',
    quote:
      'Fifteen minutes at the end of the week to look at how I used AI. I catch myself reaching for it out of habit way less now.',
    initials: 'SR',
    name: '[Name]',
    role: 'Computer Science, junior',
  },
  {
    id: '2',
    tag: 'Fewer autopilot prompts',
    quote:
      'I used to open a chat the second I got stuck. Now I pause and ask what I actually need first - and half the time I figure it out myself.',
    initials: 'JL',
    name: '[Name]',
    role: 'Biology, senior',
  },
  {
    id: '3',
    tag: 'Clearer goals per session',
    quote:
      'Setting one goal before I start keeps my sessions short and focused. I leave knowing what I learned, not just what I copied.',
    initials: 'MK',
    name: '[Name]',
    role: 'Education, graduate student',
  },
];

const MainScreen: React.FC = () => {
  return (
    <MDBContainer fluid className="main-page">
      {/* ---------- Navbar ---------- */}
      <MDBNavbar light className="main-navbar px-4">
        <MDBNavbarBrand className="fw-bold">KAIte</MDBNavbarBrand>
        <MDBNavbarNav 
        fullWidth={false}
        className="d-flex flex-row align-items-center ms-auto">
          <MDBNavbarItem>
            <MDBNavbarLink href="#home">Home</MDBNavbarLink>
          </MDBNavbarItem>
          <MDBNavbarItem>
            <MDBNavbarLink href="#chat-history">Chat History</MDBNavbarLink>
          </MDBNavbarItem>
          <MDBNavbarItem>
            <MDBNavbarLink href="#settings">Settings</MDBNavbarLink>
          </MDBNavbarItem>
          <MDBNavbarItem>
            <div className="main-avatar">{"NM"}</div>
          </MDBNavbarItem>
        </MDBNavbarNav>
      </MDBNavbar>

      {/* ---------- Hero ---------- */}
      <MDBRow className="main-hero">
        <MDBCol md="6" className="main-hero__text">
          <p className="main-eyebrow">OUR MISSION</p>
          <h1 className="main-heading">
            Reflect on how you use AI.
            <br />
            Build habits that last.
          </h1>
          <p className="main-body-text">
            KAIte gives you a dedicated space to look back on how you work with AI - what you
            rely on it for, where it helps, and where it gets in the way - so you can build more
            intentional, sustainable habits over time.
          </p>
          <p className="main-body-text">
            Bring in real conversations, reflect with a guided agent, and track how your habits
            change from one session to the next.
          </p>

          <MDBCard className="main-cta-card mb-4">
            <MDBCardBody>
            
              <MDBBtn type="button" className="main-cta-btn w-100 d-flex justify-content-between align-items-center">
                    CONTINUE TO REFLECTION CONVERSATION
                <MDBIcon fas icon="arrow-right" />
              </MDBBtn>
              <div className="d-flex main-cta-meta mt-3">
                <span>About 15 minutes</span>
                <span className="main-meta-dot">•</span>
                <span>You choose what gets saved</span>
              </div>

              <MDBRow className="mt-4">
                <MDBCol size="6">
                  <p className="fw-bold mb-1">Reflect on real conversations</p>
                  <p className="main-small-text">
                    Import chats from the AI tools you use and look at them with fresh eyes.
                  </p>
                </MDBCol>
                <MDBCol size="6">
                  <p className="fw-bold mb-1">Private by design</p>
                  <p className="main-small-text">
                    Your imported chat text stays in your browser. You decide what KAIte keeps.
                  </p>
                </MDBCol>
              </MDBRow>
            </MDBCardBody>
          </MDBCard>

          <MDBCard className="main-cta-card">
            <MDBCardBody>
              <p className="main-eyebrow">PRACTICE MODE</p>
              <p className="fw-bold mb-1">
                Run a reflection conversation where KAIte slips intentional errors into its
                responses.
              </p>
              <p className="main-small-text mb-3">
                Catch them as you go to sharpen how you read AI output.
              </p>
              <MDBBtn type="button" outline className="main-cta-btn">
                PRACTICE SPOTTING AI ERRORS <MDBIcon fas icon="arrow-right" className="ms-1" />
              </MDBBtn>
              <div className="d-flex main-cta-meta mt-3">
                <span>Includes intentional AI errors</span>
                <span className="main-meta-dot">•</span>
                <span>Earn points for each catch</span>
              </div>

              <MDBRow className="mt-4">
                <MDBCol size="6">
                  <p className="fw-bold mb-1">Spot the planted errors</p>
                  <p className="main-small-text">
                    Flag mistakes KAIte adds on purpose, from wrong facts to flawed reasoning.
                  </p>
                </MDBCol>
                <MDBCol size="6">
                  <p className="fw-bold mb-1">See what you caught</p>
                  <p className="main-small-text">
                    Review hits and misses after each session and track your progress over time.
                  </p>
                </MDBCol>
              </MDBRow>
            </MDBCardBody>
          </MDBCard>
        </MDBCol>

        {/* ---------- Example conversation panel ---------- */}
        <MDBCol md="6">
          <MDBCard className="main-chat-card">
            <MDBCardBody className="d-flex flex-column">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="d-flex">
                  <div className="main-avatar main-avatar--chat me-2">K</div>
                  <div>
                    <p className="fw-bold mb-0">Your AI-use reflection</p>
                    <p className="main-small-text mb-0">Example conversation</p>
                  </div>
                </div>
                <MDBBadge className="main-time-badge" pill light>
                  <MDBIcon far icon="clock" className="me-1" />
                  5 min read
                </MDBBadge>
              </div>

              <div className="main-chat-scroll flex-grow-1 mb-3">
                {PLACEHOLDER_MESSAGES.map((message) => (
                  <div
                    key={message.id}
                    className={`main-chat-row d-flex ${
                      message.sender === 'you' ? 'justify-content-end' : 'justify-content-start'
                    }`}
                  >
                    {message.sender === 'kaite' && (
                      <div className="main-avatar main-avatar--chat me-2">K</div>
                    )}
                    <div
                      className={`main-chat-bubble ${
                        message.sender === 'you' ? 'main-chat-bubble--you' : 'main-chat-bubble--kaite'
                      }`}
                    >
                      {message.text}
                    </div>
                    {message.sender === 'you' && (
                      <div className="main-avatar main-avatar--chat ms-2">{"NM"}</div>
                    )}
                  </div>
                ))}
              </div>

              <MDBInputGroup className="main-chat-input">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type your reflection here..."
                  disabled
                  aria-label="Reflection message input"
                />
                <MDBBtn className="main-cta-btn">
                  <MDBIcon fas icon="arrow-up"/>
                </MDBBtn>
              </MDBInputGroup>
            </MDBCardBody>
          </MDBCard>
        </MDBCol>
      </MDBRow>

      {/* ---------- Testimonials ---------- */}
      <MDBRow>
            <div className="text-center main-subheading-block">
                <p className="main-eyebrow">WHAT STUDENTS ARE SAYING</p>
                <h2 className="main-subheading">Real habits, reflected on honestly</h2>
                <hr style={{border: 'none',height: '2px',backgroundColor: '#ffffff',margin: '20px 0'}} />
            </div>
      </MDBRow>
      <MDBRow className="main-testimonials">

        {PLACEHOLDER_TESTIMONIALS.map((testimonial) => (
          <MDBCol md="4" className="mb-4" key={testimonial.id}>
            <MDBCard className="main-testimonial-card h-100">
              <MDBCardBody>
                <MDBBadge className="main-testimonial-tag mb-3" pill light>
                  {testimonial.tag}
                </MDBBadge>
                <p className="main-testimonial-quote">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="d-flex align-items-center mt-3">
                  <div className="main-avatar main-avatar--testimonial me-2">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="fw-bold mb-0">{testimonial.name}</p>
                    <p className="main-small-text mb-0">{testimonial.role}</p>
                  </div>
                </div>
              </MDBCardBody>
            </MDBCard>
          </MDBCol>
        ))}
      </MDBRow>
    </MDBContainer>
  );
};

export default MainScreen;

