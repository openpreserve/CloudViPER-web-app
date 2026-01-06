---
layout: default
title: Glossary
description: Terms and definitions for CloudViPER and digital preservation
---

# Glossary

A reference guide to terms, acronyms, and concepts used in CloudViPER and digital preservation.

---

## A

**API (Application Programming Interface)**
A set of protocols and tools that allow different software applications to communicate with each other. CloudViPER provides a REST API for programmatic access.

**Authentication**
The process of verifying the identity of a user or system. CloudViPER uses session-based authentication with bcrypt password hashing.

**Authorization**
The process of determining what permissions an authenticated user has. CloudViPER implements role-based access control (RBAC).

---

## C

**Container**
A lightweight, standalone executable package that includes everything needed to run a piece of software. CloudViPER manages ViPER instances deployed as Docker containers.

**CloudViPER**
The web-based version of ViPER that provides browser access to digital preservation tools, deployable in cloud or self-hosted environments.

---

## D

**Digital Preservation**
The active management of digital content over time to ensure ongoing access despite technological change. ViPER and CloudViPER support digital preservation workflows with open source tools.

**Docker**
An open platform for developing, shipping, and running applications in containers. CloudViPER uses Docker for containerized deployment.

**Docker Compose**
A tool for defining and running multi-container Docker applications. CloudViPER uses Docker Compose for orchestrating its services.

**DROID (Digital Record Object Identification)**
A file format identification tool developed by The National Archives UK. One of the core preservation tools available in ViPER.

---

## F

**Format Validation**
The process of checking whether a file conforms to its format specification. Tools like JHOVE and veraPDF perform format validation.

**Format Identification**
Determining the file format of a digital object, typically using tools like DROID or Tika.

---

## H

**HandBrake**
An open source video transcoding tool included in ViPER for converting video files between formats.

---

## J

**JHOVE (JSTOR/Harvard Object Validation Environment)**
A format validation and characterization tool maintained by the Open Preservation Foundation. JHOVE validates and extracts technical metadata from digital objects.

---

## M

**MediaConch**
An implementation checker tool that validates conformance of media files against technical specifications.

**MediaInfo**
A tool for displaying technical metadata about audio and video files, including codec information and container details.

**Metadata**
Data about data. In digital preservation, metadata includes technical information about file formats, creation dates, checksums, and preservation actions.

**MySQL**
An open source relational database management system used by CloudViPER for data persistence.

---

## O

**OPF (Open Preservation Foundation)**
A not-for-profit organization dedicated to long-term digital preservation through collaborative development of open source tools and standards.

---

## P

**PDF/A**
An ISO-standardized version of PDF specialized for long-term archiving of electronic documents.

---

## R

**RBAC (Role-Based Access Control)**
An access control approach that restricts system access based on user roles. CloudViPER implements RBAC with roles including Admin, Team Leader, Team Admin, and Team Member.

**REST API (Representational State Transfer API)**
An architectural style for web services that uses HTTP requests. CloudViPER provides a REST API for integration and automation.

---

## S

**Session Management**
The process of tracking user interactions across multiple requests. CloudViPER uses express-session with MySQL storage.

**Self-Hosted**
Deployment on your own infrastructure rather than using a cloud provider. CloudViPER supports both self-hosted and cloud deployments.

---

## T

**Tika**
An Apache project that detects and extracts metadata and text from various file formats.

**Traefik**
A modern reverse proxy and load balancer used by CloudViPER for routing and SSL/TLS termination.

**TypeScript**
A strongly typed programming language that builds on JavaScript. CloudViPER is written in TypeScript.

---

## V

**veraPDF**
An open source PDF/A validation tool that checks PDF files for conformance with PDF/A standards.

**ViPER (Virtual Preservation Environment)**
A virtual machine containing popular open source digital preservation tools with graphical interfaces. CloudViPER extends ViPER to web-based deployment.

**Virtual Machine (VM)**
A software emulation of a computer system. The original ViPER is distributed as a virtual machine; CloudViPER uses containerization instead.

---

## W

**Web GUI (Graphical User Interface)**
A browser-based interface for interacting with software. CloudViPER provides a web GUI for managing ViPER instances.

---

*Can't find a term? Please [contact us](https://openpreservation.org/contact-us/) or [open an issue](https://github.com/openpreserve/CloudViPER-web-app/issues) to suggest additions to this glossary.*
