import React from 'react';
import { useSite } from '../store/siteStore';

// <img> whose source is one of the image slots the admin can change in Site Settings.
const SiteImg = ({ slot, className = '', alt = '', ...rest }) => {
  const { pic } = useSite();
  return <img src={pic(slot)} alt={alt} className={className} {...rest} />;
};

export default SiteImg;
