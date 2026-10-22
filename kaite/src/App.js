import './App.css';
import {
  MDBBtn,
  MDBContainer,
  MDBRow,
  MDBCol,
  MDBCard,
  MDBCardBody,
  MDBInput,
  MDBIcon
} from 'mdb-react-ui-kit';
import 'mdb-react-ui-kit/dist/css/mdb.min.css';

function App() {
  return (
    <MDBContainer fluid className="login-page">
      <MDBRow className="d-flex justify-content-center align-items-center h-100">
        <MDBCol col="12">
          <MDBCard className="bg-dark text-white my-5 mx-auto login-card">
            <MDBCardBody className="p-5 d-flex flex-column align-items-center mx-auto w-100">
              <h2 className="fw-bold mb-2 text-uppercase">Login</h2>
              <p className="text-white-50 mb-5">Please enter your login and password</p>

              <MDBInput
                wrapperClass="mb-4 mx-5 w-100"
                labelClass="text-white"
                label="Email address"
                id="email-address"
                type="email"
                size="lg"
              />
              <MDBInput
                wrapperClass="mb-4 mx-5 w-100"
                labelClass="text-white"
                label="Password"
                id="password"
                type="password"
                size="lg"
              />

              <p className="small mb-3 pb-lg-2">
                <a className="text-white-50" href="#forgot-password">Forgot password?</a>
              </p>
              <MDBBtn outline className="mx-2 px-5" color="white" size="lg">
                Login
              </MDBBtn>

              <div className="d-flex flex-row mt-3 mb-5">
                <MDBBtn tag="a" color="none" className="m-3" style={{ color: 'white' }} aria-label="Log in with Facebook">
                  <MDBIcon fab icon="facebook-f" size="lg" />
                </MDBBtn>
                <MDBBtn tag="a" color="none" className="m-3" style={{ color: 'white' }} aria-label="Log in with Twitter">
                  <MDBIcon fab icon="twitter" size="lg" />
                </MDBBtn>
                <MDBBtn tag="a" color="none" className="m-3" style={{ color: 'white' }} aria-label="Log in with Google">
                  <MDBIcon fab icon="google" size="lg" />
                </MDBBtn>
              </div>

              <p className="mb-0">
                Don&apos;t have an account? <a href="#sign-up" className="text-white-50 fw-bold">Sign Up</a>
              </p>
            </MDBCardBody>
          </MDBCard>
        </MDBCol>
      </MDBRow>
    </MDBContainer>
  );
}

export default App;
