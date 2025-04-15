import React from 'react';
import { Helmet } from 'react-helmet-async';

export default function Head(props) {
  const title = props.title || "CRAPP: Cognitive Reporting Application";
  const description = props.description || "Daily symptom and cognition tracking application";
  
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {props.children}
    </Helmet>
  );
}