import React from 'react';
import './KaiteNavBar.css';
import {
  MDBRow,
  MDBNavbar,
  MDBNavbarBrand,
  MDBNavbarNav,
  MDBNavbarItem,
  MDBNavbarLink
} from 'mdb-react-ui-kit';
import 'mdb-react-ui-kit/dist/css/mdb.min.css';

interface KaiteNavBarProps {
    screenSetter: React.Dispatch<React.SetStateAction<number>>;
}


function KaiteNavBar({ screenSetter }: KaiteNavBarProps): React.JSX.Element {
    
    return (
      <MDBNavbar light className="main-navbar px-4">
        <MDBNavbarBrand className="fw-bold">KAIte</MDBNavbarBrand>
        <MDBNavbarNav 
        fullWidth={false}
        className="d-flex flex-row align-items-center ms-auto">
          <MDBNavbarItem onClick={() => {screenSetter(1)}}>
            <MDBNavbarLink href="#home">Dashboard</MDBNavbarLink>
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
    );
}
export default KaiteNavBar;